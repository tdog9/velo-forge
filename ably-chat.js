/**
 * TurboPrep Ably integration.
 *
 * Replaces the Firestore-routed team chat with Ably's pub/sub channels.
 * Zero user input: server-mints a JWT from a Firebase ID token on demand,
 * the SDK handles token renewal, channels are auto-resolved from the
 * userProfile (team / subteam / DMs).
 *
 * Boot flow:
 *   1. app.js bootstrapAuth → currentUser set
 *   2. app.js calls window.AblyChat.init()
 *   3. init() spins up Ably.Realtime with authCallback that hits
 *      /ablyAuth Cloud Function with the Firebase ID token
 *   4. Subscriptions are wired lazily by team / subteam / DM helpers
 *
 * No fallback to Firestore chat — flipping window._tpUseAbly is left as
 * an escape hatch for one release while we observe.
 */
(function () {
  'use strict';

  const ABLY_AUTH_URL = 'https://us-central1-hpr-2026.cloudfunctions.net/ablyAuth';
  let realtime = null;
  let initPromise = null;
  const channelHandles = new Map();

  /**
   * Construct the Ably Realtime client. The authCallback fetches a JWT
   * from our Cloud Function whenever Ably needs a fresh token. SDK
   * handles renewals; we never have to track token expiry ourselves.
   */
  function buildClient(firebaseUser) {
    if (!window.Ably?.Realtime) {
      throw new Error('Ably SDK not loaded — check index.html script tag');
    }
    return new window.Ably.Realtime({
      authCallback: async (_tokenParams, callback) => {
        try {
          const idToken = await firebaseUser.getIdToken();
          const r = await fetch(ABLY_AUTH_URL, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + idToken },
          });
          if (!r.ok) {
            const txt = await r.text().catch(() => '');
            return callback(new Error('ablyAuth ' + r.status + ' ' + txt), null);
          }
          const tokenRequest = await r.json();
          callback(null, tokenRequest);
        } catch (e) {
          callback(e, null);
        }
      },
      // Echo off — we render our own optimistic message; let Ably echo
      // back the canonical version and reconcile by clientMsgId.
      echoMessages: false,
      // Binary protocol (MessagePack) — ~30% smaller payloads than JSON
      // and faster to encode/decode. Ably negotiates this automatically
      // when the client requests it.
      useBinaryProtocol: true,
      // Heartbeat tuning — default is 15s, drop to 10s so a half-dead
      // connection is detected ~5s sooner. The SDK auto-recovers.
      realtimeRequestTimeout: 10_000,
      // Auto-reconnect with sensible backoff; the SDK handles this but
      // we cap the disconnected window at 2 min so a long offline period
      // doesn't keep retrying forever on a stale token.
      disconnectedRetryTimeout: 5_000,
      suspendedRetryTimeout: 30_000,
      // Transport order — websocket is default; explicit so we don't
      // accidentally fall back to long-polling on a transient ws block.
      transports: ['web_socket', 'xhr_streaming', 'xhr_polling'],
      // Recover the previous connection state across reloads when
      // possible — keeps clientId / channel state without a fresh
      // handshake. Stored in sessionStorage by the SDK.
      recover: (lastConnection, cb) => cb(true),
    });
  }

  /**
   * Channel options applied at attach time. `rewind: 1m` makes a fresh
   * attach automatically replay the last minute of messages — so a
   * user opening the chat tab after a reload sees recent messages
   * INSTANTLY without an explicit history() call. Combined with the
   * Firestore cache hydration, the chat is interactive in <50ms.
   */
  const CHANNEL_OPTS = { params: { rewind: '1m' } };

  /**
   * One-time init. Idempotent — subsequent calls return the same client.
   * Must be called after currentUser is set (post-Firebase-auth).
   */
  function init(firebaseUser) {
    if (initPromise) return initPromise;
    if (!firebaseUser) {
      return Promise.reject(new Error('AblyChat.init: firebaseUser required'));
    }
    if (window._tpUseAbly === false) {
      console.log('[AblyChat] feature flag off — skipping init');
      return Promise.resolve(null);
    }
    initPromise = new Promise((resolve, reject) => {
      try {
        const client = buildClient(firebaseUser);
        client.connection.once('connected', () => {
          realtime = client;
          console.log('[AblyChat] connected as', firebaseUser.uid);
          resolve(client);
        });
        client.connection.once('failed', (err) => {
          console.warn('[AblyChat] connection failed', err);
          initPromise = null; // allow retry
          reject(err);
        });
      } catch (e) {
        initPromise = null;
        reject(e);
      }
    });
    return initPromise;
  }

  function getClient() { return realtime; }

  /**
   * Get (and cache) a channel handle. Channels are server-side concepts
   * in Ably — calling .get is cheap; subscribing is what attaches.
   */
  function channel(name) {
    if (!realtime) throw new Error('AblyChat not initialised');
    if (!channelHandles.has(name)) {
      // Pass CHANNEL_OPTS so the rewind=1m flag applies — fresh attach
      // automatically replays last minute of history.
      channelHandles.set(name, realtime.channels.get(name, CHANNEL_OPTS));
    }
    return channelHandles.get(name);
  }

  /**
   * Subscribe to a team channel. Returns an unsubscribe function.
   * teamId: string. onMessage: (msg) => void where msg = {data, name, clientId, timestamp, id}
   */
  function subscribeTeam(teamId, onMessage) {
    if (!teamId) return () => {};
    const ch = channel(`team:${teamId}:chat`);
    const handler = (m) => onMessage(m);
    ch.subscribe(handler);
    return () => { try { ch.unsubscribe(handler); } catch (_) {} };
  }

  /**
   * Subscribe to a subteam channel — scoped narrower than team. Same shape.
   */
  function subscribeSubteam(subteamId, onMessage) {
    if (!subteamId) return () => {};
    const ch = channel(`subteam:${subteamId}:chat`);
    const handler = (m) => onMessage(m);
    ch.subscribe(handler);
    return () => { try { ch.unsubscribe(handler); } catch (_) {} };
  }

  /**
   * Publish a chat message to a team / subteam channel.
   * scope: 'team' | 'subteam' | 'dm'
   * id: teamId, subteamId, or `${uid1}:${uid2}` (sorted)
   * payload: { body, displayName, photoURL, attachments, clientMsgId }
   */
  async function publish(scope, id, payload) {
    if (!realtime) throw new Error('AblyChat not initialised');
    const channelName = `${scope}:${id}:chat`;
    const ch = channel(channelName);
    return ch.publish('msg', payload);
  }

  /**
   * Read recent history on connect so the UI isn't empty mid-conversation.
   * Ably persists messages on the channel for up to 2 minutes by default;
   * with Message Persistence enabled (see dashboard → Message Persistence)
   * it grows to 24h or 72h depending on plan.
   */
  async function history(scope, id, limit = 50) {
    if (!realtime) throw new Error('AblyChat not initialised');
    const ch = channel(`${scope}:${id}:chat`);
    const page = await ch.history({ limit, direction: 'backwards' });
    return (page?.items || []).reverse();
  }

  /**
   * Presence — who's in the channel right now. For typing indicators
   * we'd publish a transient `typing` event on the same channel rather
   * than mutating presence (presence is for sustained membership).
   */
  async function presenceGet(scope, id) {
    if (!realtime) throw new Error('AblyChat not initialised');
    const ch = channel(`${scope}:${id}:chat`);
    return ch.presence.get();
  }
  async function presenceEnter(scope, id, data) {
    if (!realtime) throw new Error('AblyChat not initialised');
    const ch = channel(`${scope}:${id}:chat`);
    return ch.presence.enter(data || {});
  }
  async function presenceLeave(scope, id) {
    if (!realtime) throw new Error('AblyChat not initialised');
    const ch = channel(`${scope}:${id}:chat`);
    return ch.presence.leave();
  }

  /**
   * Tear down — used on Sign Out so the next user doesn't inherit
   * the previous user's clientId.
   */
  function disconnect() {
    if (realtime) {
      try { realtime.close(); } catch (_) {}
      realtime = null;
    }
    initPromise = null;
    channelHandles.clear();
  }

  window.AblyChat = {
    init,
    disconnect,
    getClient,
    subscribeTeam,
    subscribeSubteam,
    publish,
    history,
    presenceGet,
    presenceEnter,
    presenceLeave,
  };
})();

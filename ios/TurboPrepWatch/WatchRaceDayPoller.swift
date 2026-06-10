import Foundation

/// Polls the public race-day endpoint so the Watch knows whether the iPhone
/// (or any coach/web client) has activated race-day mode for today — without
/// depending on WCSession to be reachable. The watch-pair flow already gave
/// us iPhone-independent identity; this finishes the job for race-day state.
///
/// - Polls `/race-day-public` every 15s while the Watch is paired.
/// - Sets `WatchAppState.raceDayActive` from the `active` field in the
///   response. Local in-progress stint (raceDayStartedAt) is preserved so
///   a flicker on the iPhone doesn't tear down the rider's lap data.
/// - The endpoint is read-only and CORS-open; no auth required.
@MainActor
final class WatchRaceDayPoller {
    static let shared = WatchRaceDayPoller()
    private init() {}

    /// Production endpoint. The watch-pair flow already uses turboprep.app —
    /// keeping the same domain so a single DNS/SSL outage takes both down at
    /// once instead of leaving us in a half-broken state.
    private let baseUrl = "https://turboprep.app/.netlify/functions/race-day-public"
    private let pollInterval: TimeInterval = 15
    private var timer: Timer?
    private var inFlight = false

    /// Start polling. Idempotent. Fires immediately, then every 15s.
    func start() {
        stop()
        // Fire once right now so the rider doesn't wait 15s on first launch.
        Task { await self.tick() }
        let t = Timer.scheduledTimer(withTimeInterval: pollInterval, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in await self.tick() }
        }
        // Keep firing while watchOS is in any common run loop mode.
        RunLoop.main.add(t, forMode: .common)
        self.timer = t
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }

    /// Force an immediate fetch — used when the Watch comes back to
    /// foreground (raise-to-wake, switch from another app), so the
    /// rider doesn't see stale state for up to 15s after wake.
    func pokeNow() {
        Task { await self.tick() }
    }

    private func tick() async {
        // Only poll while paired — no point hitting the network if the
        // rider hasn't connected to a TurboPrep account.
        guard WatchAppState.shared.watchPaired else { return }
        // Drop overlapping requests if the previous one is still in flight.
        guard !inFlight else { return }
        inFlight = true
        defer { inFlight = false }

        // Scope by team — without teamId the endpoint returns the global
        // raceday meta (`rd.active`) which goes true whenever ANY team
        // activates race-day that day. With teamId the endpoint only
        // reports active=true when our team is the one running.
        let teamId = WatchAppState.shared.teamId
        let urlString = teamId.map { "\(baseUrl)?teamId=\($0)" } ?? baseUrl
        guard let url = URL(string: urlString) else { return }
        var req = URLRequest(url: url)
        req.timeoutInterval = 10
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
            let active = (json["active"] as? Bool) ?? false
            // Route through applyRemoteSnapshot so the activate /
            // deactivate logic (archive-on-off, no auto-start) lives
            // in one place and the iPhone WCSession path + this
            // polling fallback can never drift apart.
            WatchAppState.shared.applyRemoteSnapshot(["raceDayActive": active])
        } catch {
            // Silent: a missed poll just means the next one tries again.
        }
    }
}

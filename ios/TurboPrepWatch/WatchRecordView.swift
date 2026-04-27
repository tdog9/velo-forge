import SwiftUI
import WatchKit

/// Center "Record" tab. Behaviour:
/// - Race-day mode active → big lap timer with tap-to-lap and live BPM.
/// - Otherwise → standard HPV ride session (HKWorkoutSession + send to iPhone).
struct WatchRecordView: View {
    @EnvironmentObject private var state: WatchAppState

    var body: some View {
        Group {
            if state.raceDayActive {
                TabView {
                    RaceDayLapView()
                        .containerBackground(Theme.bg.gradient, for: .tabView)
                    RaceDayLeaderboardView()
                        .containerBackground(Theme.bg.gradient, for: .tabView)
                }
                .tabViewStyle(.page)
            } else {
                WorkoutSessionView()
            }
        }
    }
}

/// Live race-day standings — pushed from the iPhone (which reads Firestore
/// stints). Entries ordered by lap count desc then best lap asc; "you" row
/// gets the orange accent so it's findable at a wrist-glance.
struct RaceDayLeaderboardView: View {
    @EnvironmentObject private var state: WatchAppState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Circle().fill(Theme.phasePeak).frame(width: 6, height: 6)
                    Text("STANDINGS")
                        .font(.system(size: 10, weight: .heavy))
                        .tracking(0.6)
                        .foregroundStyle(Theme.phasePeak)
                }
                .padding(.top, 4)
                if state.raceDayLeaderboard.isEmpty {
                    ThemeCard {
                        Text("Standings appear once your team starts logging stints.")
                            .font(.system(.caption2))
                            .foregroundStyle(Theme.mutedFg)
                    }
                } else {
                    ForEach(state.raceDayLeaderboard) { e in
                        leaderboardRow(e)
                    }
                }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 12)
        }
    }

    private func leaderboardRow(_ e: WatchLeaderboardEntry) -> some View {
        HStack(spacing: 6) {
            Text("\(e.rank)")
                .font(.system(.caption, design: .rounded, weight: .heavy))
                .foregroundStyle(e.isMe ? Theme.primary : Theme.mutedFg)
                .frame(width: 18, alignment: .leading)
                .monospacedDigit()
            VStack(alignment: .leading, spacing: 1) {
                Text(e.displayName)
                    .font(.system(.caption, weight: e.isMe ? .heavy : .semibold))
                    .foregroundStyle(e.isMe ? Theme.primary : Theme.fg)
                    .lineLimit(1)
                if let best = e.bestMs {
                    Text("Best \(formatLap(best))")
                        .font(.system(size: 9, design: .rounded))
                        .foregroundStyle(Theme.mutedFg)
                        .monospacedDigit()
                }
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 1) {
                Text("\(e.lapCount)")
                    .font(.system(.caption, design: .rounded, weight: .heavy))
                    .foregroundStyle(Theme.fg)
                    .monospacedDigit()
                Text("laps")
                    .font(.system(size: 9))
                    .foregroundStyle(Theme.mutedFg)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(e.isMe ? Theme.primary.opacity(0.1) : Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                .stroke(e.isMe ? Theme.primary.opacity(0.5) : Theme.border, lineWidth: 0.5)
        )
    }

    private func formatLap(_ ms: Int) -> String {
        let s = ms / 1000
        let m = s / 60
        let rem = s % 60
        return String(format: "%d:%02d", m, rem)
    }
}

/// Race-day lap timer. Tap the centre area to record a split. Hold "End" to
/// finalize. Lap data accumulates in WatchAppState; iPhone-side will push
/// the race-day stints to Firestore (currently held locally).
struct RaceDayLapView: View {
    @EnvironmentObject private var state: WatchAppState
    @StateObject private var health = HealthKitService()
    @StateObject private var locator = WatchLocationService()
    @State private var lapStartedAt: Date = Date()
    @State private var now: Date = Date()
    private let tick = Timer.publish(every: 0.1, on: .main, in: .common).autoconnect()

    /// When the most recent lap was recorded — used to anchor the current-lap
    /// timer to either the stint start (lap 1) or the last completed lap.
    private var lapAnchor: Date {
        if let mostRecent = state.raceDayLaps.first {
            return mostRecent.recordedAt
        }
        return state.raceDayStartedAt ?? Date()
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(Theme.phasePeak)
                        .frame(width: 6, height: 6)
                    Text("LAP \(state.raceDayLaps.count + 1)")
                        .font(.system(size: 10, weight: .heavy))
                        .tracking(0.6)
                        .foregroundStyle(Theme.phasePeak)
                    Spacer(minLength: 0)
                    if let hr = health.latestHeartRate {
                        HStack(spacing: 2) {
                            Image(systemName: "heart.fill")
                                .foregroundStyle(Theme.heartRateColor)
                                .font(.system(size: 9))
                            Text("\(hr)")
                                .font(.system(.caption2, design: .rounded, weight: .heavy))
                                .foregroundStyle(Theme.fg)
                                .monospacedDigit()
                        }
                    }
                    if let mps = locator.currentSpeedMps, mps >= 0 {
                        HStack(spacing: 2) {
                            Image(systemName: "speedometer")
                                .foregroundStyle(Theme.primary)
                                .font(.system(size: 9))
                            Text(String(format: "%.0f", mps * 3.6))  // km/h
                                .font(.system(.caption2, design: .rounded, weight: .heavy))
                                .foregroundStyle(Theme.fg)
                                .monospacedDigit()
                        }
                    }
                }

                // BIG TAP-LAP button — fills width, minHeight ensures a
                // generous 90pt tap target. Plain Button so the entire
                // gradient rectangle is the hit area.
                Button(action: recordLap) {
                    VStack(spacing: 4) {
                        Text(currentLapText)
                            .font(.system(size: 40, weight: .black, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(Theme.fg)
                            .minimumScaleFactor(0.6)
                            .lineLimit(1)
                        Text("TAP TO LAP")
                            .font(.system(size: 11, weight: .heavy))
                            .tracking(1.0)
                            .foregroundStyle(.white)
                    }
                    .frame(maxWidth: .infinity, minHeight: 90)
                    .padding(.vertical, 18)
                    .background(
                        LinearGradient(
                            colors: [Theme.primary, Theme.primary.opacity(0.78)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(.plain)

                HStack(spacing: 6) {
                    if let best = bestLapText {
                        statPill(label: "BEST", value: best, color: Theme.primary)
                    }
                    statPill(label: "TOTAL", value: format(now.timeIntervalSince(state.raceDayStartedAt ?? now)), color: Theme.mutedFg)
                }

                Button(role: .destructive) {
                    finishStint()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "stop.fill").font(.system(size: 12))
                        Text("Finish stint")
                            .font(.system(.caption, weight: .heavy))
                        Spacer(minLength: 0)
                    }
                    .foregroundStyle(.white)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 12)
                    .frame(maxWidth: .infinity)
                    .background(Theme.phasePeak)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .contentShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)

                if !state.raceDayLaps.isEmpty {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("LAPS")
                            .font(.system(size: 9, weight: .heavy))
                            .tracking(0.6)
                            .foregroundStyle(Theme.mutedFg)
                            .padding(.horizontal, 4)
                            .padding(.top, 4)
                        ForEach(state.raceDayLaps.prefix(6)) { lap in
                            HStack {
                                Text("L\(lap.number)")
                                    .font(.system(.caption2, weight: .bold))
                                    .foregroundStyle(Theme.mutedFg)
                                    .frame(width: 26, alignment: .leading)
                                Text(format(lap.durationSeconds))
                                    .font(.system(.caption, design: .rounded, weight: .semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(Theme.fg)
                                Spacer(minLength: 0)
                                if lap.durationSeconds == bestLapSeconds {
                                    Text("BEST")
                                        .font(.system(size: 8, weight: .heavy))
                                        .foregroundStyle(Theme.primary)
                                }
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
                        }
                    }
                }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 12)
        }
        .onReceive(tick) { now = $0 }
        .task {
            if health.authorization == .notRequested {
                await health.requestAuthorization()
            }
            if health.authorization == .granted {
                await health.refreshLatestHeartRate()
                health.startHeartRateStreaming()
            }
            locator.start()
        }
        .onDisappear {
            health.stopHeartRateStreaming()
            locator.stop()
        }
    }

    private func statPill(label: String, value: String, color: Color) -> some View {
        HStack(spacing: 3) {
            Text(label)
                .font(.system(size: 8, weight: .heavy))
                .tracking(0.4)
                .foregroundStyle(Theme.mutedFg)
            Text(value)
                .font(.system(.caption2, design: .rounded, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(color)
        }
        .padding(.vertical, 3)
        .padding(.horizontal, 8)
        .background(color.opacity(0.10))
        .clipShape(Capsule())
    }

    private func recordLap() {
        // Auto-recover the stint start time if it was lost (e.g. crash + load
        // restored raceDayActive=true with raceDayStartedAt=nil). Without this
        // the lap-anchor falls back to Date() and the 250ms guard rejects
        // lap 1 with a "0 duration" — silently swallowing the user's tap.
        if state.raceDayStartedAt == nil {
            state.raceDayStartedAt = Date()
            NSLog("📲 [Watch] lap: auto-recovered raceDayStartedAt")
        }
        let dur = Date().timeIntervalSince(lapAnchor)
        // Defensive: ignore double-taps under 250ms (finger bounce). For the
        // very first lap we still allow short durations because the user may
        // intentionally tap right after starting.
        let isFirstLap = state.raceDayLaps.isEmpty
        if !isFirstLap && dur < 0.25 {
            NSLog("📲 [Watch] lap: rejected dur=%.3fs (debounce)", dur)
            return
        }
        state.recordLap(durationSeconds: dur)
        NSLog("📲 [Watch] lap: recorded #%d dur=%.2fs (laps=%d)", state.raceDayLaps.first?.number ?? 0, dur, state.raceDayLaps.count)
        playHaptic(.click)
        // Stream this lap upstream so the iPhone updates Firestore live state
        // immediately — teammates see the spectator panel tick up rather than
        // waiting until the stint ends.
        ConnectivityService.shared.sendRaceDayLaps([
            "kind": "live_lap",
            "stintStartedAt": (state.raceDayStartedAt ?? Date()).timeIntervalSince1970,
            "lapCount": state.raceDayLaps.count,
            "lastLapMs": Int(dur * 1000),
            "bestLapMs": Int((state.raceDayLaps.map(\.durationSeconds).min() ?? dur) * 1000),
        ])
    }

    private func playHaptic(_ kind: WKHapticType) {
        WKInterfaceDevice.current().play(kind)
    }

    private func finishStint() {
        // Archive locally first so the athlete can review laps afterwards
        // even if the iPhone bridge isn't reachable. Then auto-sync the
        // freshly-archived stint upstream — WCSession queues via
        // transferUserInfo when the iPhone is asleep, so delivery is
        // best-effort but durable. Critically: only mark the stint as
        // synced once WCSession has accepted the payload; otherwise a
        // failed dispatch would silently lose data.
        state.archiveCurrentStint()
        if let last = state.pastStints.first, !last.synced {
            let payload: [String: Any] = [
                "stintId":        last.id.uuidString,
                "stintStartedAt": last.startedAt.timeIntervalSince1970,
                "stintEndedAt":   last.endedAt.timeIntervalSince1970,
                "laps": last.laps.map { lap in
                    [
                        "number":     lap.number,
                        "duration":   Int(lap.durationSeconds * 1000),
                        "recordedAt": lap.recordedAt.timeIntervalSince1970,
                    ] as [String: Any]
                },
            ]
            ConnectivityService.shared.sendRaceDayLaps(payload, onSent: { @MainActor success in
                if success { WatchAppState.shared.markAllStintsSynced() }
            })
        }
        state.raceDayLaps.removeAll()
        state.raceDayActive = false
        state.raceDayStartedAt = nil
    }

    private var currentLapText: String {
        format(now.timeIntervalSince(lapAnchor))
    }

    private var bestLapSeconds: TimeInterval? {
        state.raceDayLaps.map(\.durationSeconds).min()
    }

    private var bestLapText: String? {
        bestLapSeconds.map(format)
    }

    private func format(_ t: TimeInterval) -> String {
        let total = Int(t)
        let m = total / 60
        let s = total % 60
        let ms = Int((t - TimeInterval(total)) * 10)
        return String(format: "%d:%02d.%d", m, s, ms)
    }
}

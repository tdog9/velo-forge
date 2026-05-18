import SwiftUI
import WatchKit
import Combine
import CoreLocation

/// Centre "Record" tab. Two completely different UIs:
/// - Race-day mode active → single-page race screen (RaceDayView).
///   The whole Watch is locked into this screen by WatchRootView when
///   raceDayActive is true, so the rider can't accidentally swipe to
///   Today / Fitness / Dev while paddling.
/// - Otherwise → standard HPV ride session (HKWorkoutSession + send to iPhone).
struct WatchRecordView: View {
    @EnvironmentObject private var state: WatchAppState

    var body: some View {
        Group {
            if state.raceDayActive {
                RaceDayView()
            } else {
                WorkoutSessionView()
            }
        }
    }
}

// MARK: - Race-day single-page view ─────────────────────────────────────────
/// Two sub-states:
/// 1. Pre-stint (`raceDayStartedAt == nil`): stint duration picker +
///    Start Stint button. Only the Start button is pressable — locked
///    so the rider can't fat-finger a tap mid-grid.
/// 2. Active stint (`raceDayStartedAt != nil`): single screen with HR,
///    speed, lap time, and stint countdown — all visible without scroll
///    or swipe. Big tap-to-lap zone fills the lower half. One small
///    Finish button at the bottom.
///
/// HKWorkoutSession + GPS + HR streaming start the moment the rider
/// taps Start Stint and stop on Finish Stint, so the screen-on
/// guarantee is in effect for the duration of the stint.
struct RaceDayView: View {
    @EnvironmentObject private var state: WatchAppState
    @StateObject private var health = HealthKitService()
    @StateObject private var locator = WatchLocationService()
    /// HKWorkoutSession wrapper — the only way to keep the watchOS
    /// screen on continuously and to feed live HR via HKLiveWorkoutBuilder.
    @StateObject private var raceSession = WorkoutSessionService()
    @State private var now: Date = Date()
    @State private var tickCancellable: AnyCancellable?
    @State private var lastCountdownAlert: Int = -1
    /// Timestamp of the most-recent watch-battery push to iPhone — used
    /// to throttle to one send per 60 s (rec #50).
    @State private var lastBatterySentAt: Date = .distantPast

    var body: some View {
        Group {
            if state.stintInProgress {
                activeStintView
            } else {
                preStintView
            }
        }
        .onAppear {
            // Tick at 100ms while visible so the lap timer + countdown
            // both feel live. autoconnect on a module publisher would
            // bleed battery; gating on .onAppear/onDisappear is correct.
            tickCancellable = Timer.publish(every: 0.1, on: .main, in: .common)
                .autoconnect()
                .sink { now = $0 }
        }
        .onDisappear {
            tickCancellable?.cancel()
            tickCancellable = nil
            health.stopHeartRateStreaming()
            locator.stop()
            // End the workout session if we somehow left mid-stint —
            // belt-and-braces; finishStint() also calls this.
            Task { _ = await raceSession.end() }
        }
        // Auto-lap detection: every time the location service updates
        // the current coord, check whether we've crossed start/finish.
        .onChange(of: locator.currentCoord?.latitude) { _, _ in
            tryAutoLap()
        }
        // Haptic alerts as the stint countdown approaches zero.
        .onChange(of: now) { _, newNow in
            checkCountdownAlerts(at: newNow)
            // Throttled Watch-battery push to the iPhone (rec #50) —
            // fires once per minute while a stint is active so the pit
            // crew can decide whether to swap the Watch before the
            // next handoff.
            if state.stintInProgress
               && newNow.timeIntervalSince(lastBatterySentAt) >= 60 {
                lastBatterySentAt = newNow
                let dev = WKInterfaceDevice.current()
                dev.isBatteryMonitoringEnabled = true
                let level = dev.batteryLevel // -1.0 if unavailable
                let stateRaw = dev.batteryState.rawValue // 0 unknown, 1 unplugged, 2 charging, 3 full
                if level >= 0 {
                    ConnectivityService.shared.sendWatchBattery(level: level, state: stateRaw)
                }
            }
        }
    }

    // MARK: - Pre-stint screen ─────────────────────────────────────────────
    private var preStintView: some View {
        VStack(spacing: 8) {
            HStack(spacing: 6) {
                Circle().fill(Theme.phasePeak).frame(width: 6, height: 6)
                Text("RACE DAY")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.8)
                    .foregroundStyle(Theme.phasePeak)
                Spacer(minLength: 0)
            }

            // Stint duration picker — five chips, tap to select. The
            // chosen value drives the countdown timer once the rider
            // taps Start Stint. Persisted in WatchAppState across
            // launches so the rider doesn't reset it every race.
            VStack(alignment: .leading, spacing: 4) {
                Text("STINT LENGTH")
                    .font(.system(size: 9, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(Theme.mutedFg)
                HStack(spacing: 4) {
                    ForEach([10, 20, 30, 45, 60], id: \.self) { mins in
                        durationChip(mins)
                    }
                }
            }

            // Big Start Stint button — only pressable element. Plain
            // Button so the entire orange rectangle is the hit area.
            Button(action: startStint) {
                HStack(spacing: 6) {
                    Image(systemName: "play.fill")
                        .font(.system(size: 14, weight: .heavy))
                    Text("START STINT")
                        .font(.system(size: 14, weight: .heavy))
                        .tracking(0.5)
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 56)
                .background(
                    LinearGradient(
                        colors: [Theme.primary, Theme.primary.opacity(0.78)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .buttonStyle(.plain)

            // Local escape hatch — only effective when no stint is in
            // progress, so this can't accidentally end a real race.
            // Lets the rider dismiss race-mode lock on this device when
            // the iPhone left team-mode flag on but they're not racing.
            Button(action: exitRaceMode) {
                Text("Exit race mode")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.mutedFg)
                    .frame(maxWidth: .infinity, minHeight: 28)
                    .background(Theme.surface.opacity(0.5))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(.top, 4)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 8)
        .padding(.top, 6)
        .padding(.bottom, 4)
    }

    /// Locally toggle the race-mode lock off on this Watch. Only does
    /// anything when no stint is in progress, so an actual rider mid-
    /// stint can't tap this away by accident.
    private func exitRaceMode() {
        guard !state.stintInProgress else { return }
        WKInterfaceDevice.current().play(.success)
        state.raceDayActive = false
        state.raceDayStartedAt = nil
    }

    private func durationChip(_ mins: Int) -> some View {
        let active = state.stintDurationMinutes == mins
        return Button {
            WKInterfaceDevice.current().play(.click)
            state.stintDurationMinutes = mins
        } label: {
            Text("\(mins)")
                .font(.system(size: 14, weight: .heavy, design: .rounded))
                .foregroundStyle(active ? Theme.bg : Theme.fg)
                .frame(maxWidth: .infinity, minHeight: 32)
                .background(active ? Theme.primary : Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Active stint screen ──────────────────────────────────────────
    /// Single-page, no scroll, no swipe. Lap detection is fully automatic
    /// via GPS — the location service pins the start/finish line and
    /// fires recordLap() whenever the rider crosses within 30m. The
    /// rider never has to look down or interact mid-stint.
    private var activeStintView: some View {
        VStack(spacing: 6) {
            // Header row: lap counter + stint countdown.
            HStack(spacing: 4) {
                Text("LAP \(state.raceDayLaps.count + 1)")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(Theme.phasePeak)
                Spacer(minLength: 0)
                Text(stintCountdownText)
                    .font(.system(.caption, design: .rounded, weight: .heavy))
                    .monospacedDigit()
                    .foregroundStyle(stintCountdownColor)
            }

            // BIG current-lap timer.
            Text(currentLapText)
                .font(.system(size: 38, weight: .black, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Theme.fg)
                .minimumScaleFactor(0.6)
                .lineLimit(1)

            // HR + speed inline. Two cells, balanced widths.
            HStack(spacing: 6) {
                statCell(
                    icon: "heart.fill",
                    iconColor: Theme.heartRateColor,
                    value: health.latestHeartRate.map(String.init) ?? "—",
                    unit: "BPM"
                )
                statCell(
                    icon: "speedometer",
                    iconColor: Theme.primary,
                    value: speedKmhText,
                    unit: "KM/H"
                )
            }

            // Last-lap + best-lap pills, OR the auto-lap status banner
            // before any laps are in. The banner tells the rider what the
            // GPS lap detector is doing so they don't worry that nothing
            // is being recorded.
            lapStatusView
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            // Pit button + finish button on the same row. Pit is a
            // single-tap counter; the count rides along with the stint
            // payload sent to the iPhone on finish.
            HStack(spacing: 4) {
                Button(action: bumpPit) {
                    HStack(spacing: 3) {
                        Image(systemName: "wrench.fill").font(.system(size: 10))
                        Text("Pit \(state.raceDayPits)")
                            .font(.system(size: 11, weight: .heavy))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 26)
                    .background(Color(red: 0.97, green: 0.45, blue: 0.09))
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .buttonStyle(.plain)
                Button(role: .destructive, action: finishStint) {
                    HStack(spacing: 3) {
                        Image(systemName: "stop.fill").font(.system(size: 10))
                        Text("Finish")
                            .font(.system(size: 11, weight: .heavy))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 26)
                    .background(Theme.phasePeak)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 6)
        .padding(.top, 4)
        .padding(.bottom, 4)
        .task {
            // Authorise + start sensors on first appearance of the active
            // screen. Subsequent re-renders are idempotent.
            if health.authorization == .notRequested {
                await health.requestAuthorization()
            }
            if health.authorization == .granted {
                await health.refreshLatestHeartRate()
                health.startHeartRateStreaming()
            }
            locator.start()
            await raceSession.start()
        }
    }

    /// Bottom panel — replaces the old tap-to-lap button.
    /// Before any laps: a status line explaining that auto-lap is armed
    /// (or pending if the GPS pin hasn't landed yet).
    /// After laps: last-lap pill + best-lap pill, side by side.
    @ViewBuilder
    private var lapStatusView: some View {
        if state.raceDayLaps.isEmpty {
            VStack(spacing: 4) {
                HStack(spacing: 6) {
                    Image(systemName: locator.startFinishCoord == nil ? "scope" : "flag.checkered")
                        .font(.system(size: 11, weight: .heavy))
                        .foregroundStyle(locator.startFinishCoord == nil ? Theme.mutedFg : Theme.primary)
                    Text(locator.startFinishCoord == nil ? "Auto-lap arming…" : "Auto-lap ready")
                        .font(.system(size: 12, weight: .heavy))
                        .tracking(0.4)
                        .foregroundStyle(locator.startFinishCoord == nil ? Theme.mutedFg : Theme.primary)
                }
                Text(locator.startFinishCoord == nil
                     ? "Crossing line will pin start/finish"
                     : "Lap fires automatically across the line")
                    .font(.system(size: 9))
                    .foregroundStyle(Theme.mutedFg)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.horizontal, 4)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        } else {
            HStack(spacing: 6) {
                lapPill(label: "LAST",
                        value: format(state.raceDayLaps.first?.durationSeconds ?? 0),
                        color: Theme.fg)
                lapPill(label: "BEST",
                        value: format(state.raceDayLaps.map(\.durationSeconds).min() ?? 0),
                        color: Theme.primary)
            }
        }
    }

    private func lapPill(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.system(size: 8, weight: .heavy))
                .tracking(0.6)
                .foregroundStyle(Theme.mutedFg)
            Text(value)
                .font(.system(.title3, design: .rounded, weight: .heavy))
                .monospacedDigit()
                .foregroundStyle(color)
                .minimumScaleFactor(0.5)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, minHeight: 38)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func statCell(icon: String, iconColor: Color, value: String, unit: String) -> some View {
        VStack(alignment: .center, spacing: 1) {
            HStack(spacing: 3) {
                Image(systemName: icon)
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(iconColor)
                Text(value)
                    .font(.system(.title3, design: .rounded, weight: .heavy))
                    .monospacedDigit()
                    .foregroundStyle(Theme.fg)
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
            }
            Text(unit)
                .font(.system(size: 8, weight: .heavy))
                .tracking(0.6)
                .foregroundStyle(Theme.mutedFg)
        }
        .frame(maxWidth: .infinity, minHeight: 38)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    // MARK: - Derived values ───────────────────────────────────────────────

    /// Anchor for the current-lap timer — either the most recent lap
    /// recorded or, if no laps yet, the stint start time.
    private var lapAnchor: Date {
        if let mostRecent = state.raceDayLaps.first { return mostRecent.recordedAt }
        return state.raceDayStartedAt ?? Date()
    }

    private var currentLapText: String {
        format(now.timeIntervalSince(lapAnchor))
    }

    private var stintCountdownText: String {
        guard let endsAt = state.stintEndsAt else { return "—" }
        let remaining = max(0, endsAt.timeIntervalSince(now))
        let m = Int(remaining) / 60
        let s = Int(remaining) % 60
        return String(format: "%d:%02d ⏱", m, s)
    }

    /// Countdown turns amber under 1 minute, red at zero — high-contrast
    /// signal so the rider sees stint expiry without reading the digits.
    private var stintCountdownColor: Color {
        guard let endsAt = state.stintEndsAt else { return Theme.mutedFg }
        let remaining = endsAt.timeIntervalSince(now)
        if remaining <= 0 { return Color.red }
        if remaining < 60 { return Color.orange }
        return Theme.fg
    }

    private var speedKmhText: String {
        guard let mps = locator.currentSpeedMps, mps >= 0 else { return "—" }
        return String(format: "%.0f", mps * 3.6)
    }

    private func format(_ t: TimeInterval) -> String {
        let total = Int(t)
        let m = total / 60
        let s = total % 60
        let ms = Int((t - TimeInterval(total)) * 10)
        return String(format: "%d:%02d.%d", m, s, ms)
    }

    // MARK: - Actions ──────────────────────────────────────────────────────

    private func startStint() {
        WKInterfaceDevice.current().play(.start)
        state.startStint()
        // Tell the iPhone right away — even before the first lap — so
        // the spectator board shows this rider as "live". sendRaceDayLaps
        // is the existing transport for live updates.
        ConnectivityService.shared.sendRaceDayLaps([
            "kind": "stint_started",
            "stintStartedAt": (state.raceDayStartedAt ?? Date()).timeIntervalSince1970,
            "stintDurationMin": state.stintDurationMinutes,
        ])
    }

    private func recordLap() {
        // Auto-recover the stint start time if it was lost (e.g. crash +
        // load restored raceDayActive=true with raceDayStartedAt=nil).
        // Without this the lap-anchor falls back to Date() and the 250ms
        // guard rejects lap 1 with a "0 duration".
        if state.raceDayStartedAt == nil {
            state.raceDayStartedAt = Date()
        }
        let dur = Date().timeIntervalSince(lapAnchor)
        let isFirstLap = state.raceDayLaps.isEmpty
        if !isFirstLap && dur < 0.25 {
            return
        }
        state.recordLap(durationSeconds: dur)
        WKInterfaceDevice.current().play(.click)
        ConnectivityService.shared.sendRaceDayLaps([
            "kind": "live_lap",
            "stintStartedAt": (state.raceDayStartedAt ?? Date()).timeIntervalSince1970,
            "lapCount": state.raceDayLaps.count,
            "lastLapMs": Int(dur * 1000),
            "bestLapMs": Int((state.raceDayLaps.map(\.durationSeconds).min() ?? dur) * 1000),
        ])
    }

    /// Auto-lap when the rider's GPS position crosses the start/finish
    /// line. Mirrors raceday.js: within 30m AND ≥20s since the last lap.
    private func tryAutoLap() {
        guard let dist = locator.distanceToStartFinishM(), dist < 30 else { return }
        let lastLapAt: Date = state.raceDayLaps.first?.recordedAt
            ?? state.raceDayStartedAt
            ?? Date()
        guard Date().timeIntervalSince(lastLapAt) >= 20 else { return }
        recordLap()
    }

    /// Three escalating haptic alerts as the stint runs out: 60s, 10s, 0s.
    /// Keyed on integer-second remaining so we fire each one exactly once.
    private func checkCountdownAlerts(at instant: Date) {
        guard let endsAt = state.stintEndsAt else { return }
        let remaining = Int(endsAt.timeIntervalSince(instant))
        let triggers: [Int: WKHapticType] = [60: .notification, 10: .directionUp, 0: .failure]
        for (mark, kind) in triggers where remaining == mark && lastCountdownAlert != mark {
            WKInterfaceDevice.current().play(kind)
            lastCountdownAlert = mark
        }
    }

    private func bumpPit() {
        WKInterfaceDevice.current().play(.click)
        state.bumpPit()
    }

    private func finishStint() {
        // Capture the pit count before archive clears it, so we can
        // forward it to the iPhone bridge alongside the lap payload.
        let pitCount = state.raceDayPits
        // Archive the in-flight stint locally so the rider can review
        // laps after the test even if the iPhone bridge isn't reachable.
        state.archiveCurrentStint()
        if let last = state.pastStints.first, !last.synced {
            let stintId = last.id
            let payload: [String: Any] = [
                "stintId":        stintId.uuidString,
                "stintStartedAt": last.startedAt.timeIntervalSince1970,
                "stintEndedAt":   last.endedAt.timeIntervalSince1970,
                "pitCount":       pitCount,
                "laps": last.laps.map { lap in
                    [
                        "number":     lap.number,
                        "duration":   Int(lap.durationSeconds * 1000),
                        "recordedAt": lap.recordedAt.timeIntervalSince1970,
                    ] as [String: Any]
                },
            ]
            ConnectivityService.shared.sendRaceDayLaps(payload, onSent: { @MainActor success in
                if success { WatchAppState.shared.markStintSynced(stintId: stintId) }
            })
        }
        // Finishing a stint returns the Watch to the pre-stint screen
        // (still in race-day mode, ready to start again). Race-day mode
        // itself is only exited when the iPhone toggles it off.
        state.raceDayLaps.removeAll()
        state.raceDayPits = 0
        state.raceDayStartedAt = nil
        lastCountdownAlert = -1
        WKInterfaceDevice.current().play(.stop)
        // End the workout session so screen-wake / HR streaming releases.
        Task { _ = await raceSession.end() }
    }
}

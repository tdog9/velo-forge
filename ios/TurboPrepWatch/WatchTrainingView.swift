import SwiftUI
import WatchKit
import Combine

/// Watch training view — locks the Watch to a single, focused screen
/// for the duration of a scheduled training session. Mirror of the
/// race-day RaceDayView but without multi-driver / stint scaffolding.
///
/// v3.11: pre-session adds a workout-type selector (ride / strength /
/// interval / cooldown). Active session shows a 5-zone HR strip
/// (computed from age + max HR), a battery-saver toggle, and per-
/// minute haptic cues so the rider doesn't have to look at the wrist.
struct WatchTrainingView: View {
    @EnvironmentObject private var state: WatchAppState
    @StateObject private var health = HealthKitService()
    @StateObject private var session = WorkoutSessionService()
    @State private var now: Date = Date()
    @State private var tickCancellable: AnyCancellable?
    @State private var lastHapticMinute: Int = -1
    @State private var batterySaver: Bool = UserDefaults.standard.bool(forKey: "tp_watch_battery_saver")
    @State private var pendingType: String = "ride"

    private static let workoutTypes: [(id: String, label: String, icon: String)] = [
        ("ride",     "Ride",     "bicycle"),
        ("strength", "Strength", "dumbbell.fill"),
        ("interval", "Interval", "bolt.fill"),
        ("cooldown", "Cooldown", "leaf.fill"),
    ]

    var body: some View {
        Group {
            if state.trainingStartedAt != nil {
                activeView
            } else {
                preSessionView
            }
        }
        .onAppear {
            // Slow tick when battery-saver is on — UI updates every 1s
            // instead of 0.5s. Saves ~half the SwiftUI redraw cost.
            let interval: TimeInterval = batterySaver ? 1.0 : 0.5
            tickCancellable = Timer.publish(every: interval, on: .main, in: .common)
                .autoconnect()
                .sink { now = $0 }
            pendingType = state.trainingType
        }
        .onDisappear {
            tickCancellable?.cancel()
            tickCancellable = nil
            health.stopHeartRateStreaming()
            Task { _ = await session.end() }
        }
        // Per-minute haptic cue while training. Audio cues land via a
        // light tap that's noticeable through gloves but not annoying.
        .onChange(of: elapsedMinute) { _, newValue in
            guard state.trainingStartedAt != nil else { return }
            guard newValue > 0, newValue != lastHapticMinute else { return }
            lastHapticMinute = newValue
            WKInterfaceDevice.current().play(.click)
        }
    }

    // MARK: - Pre-session screen ─────────────────────────────────────────
    private var preSessionView: some View {
        VStack(spacing: 6) {
            HStack(spacing: 6) {
                Circle().fill(Theme.primary).frame(width: 6, height: 6)
                Text(state.trainingTitle.uppercased())
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(Theme.primary)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }

            // Workout-type selector — chip row. Tap selects, persists
            // into pendingType which is read on Start.
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    ForEach(Self.workoutTypes, id: \.id) { t in
                        Button {
                            WKInterfaceDevice.current().play(.click)
                            pendingType = t.id
                        } label: {
                            HStack(spacing: 3) {
                                Image(systemName: t.icon)
                                    .font(.system(size: 10, weight: .heavy))
                                Text(t.label)
                                    .font(.system(size: 11, weight: .heavy))
                            }
                            .foregroundStyle(pendingType == t.id ? .white : Theme.mutedFg)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 5)
                            .background(pendingType == t.id ? Theme.primary : Theme.surface)
                            .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Spacer(minLength: 0)

            Button(action: startSession) {
                HStack(spacing: 6) {
                    Image(systemName: "play.fill")
                        .font(.system(size: 14, weight: .heavy))
                    Text("START")
                        .font(.system(size: 13, weight: .heavy))
                        .tracking(0.4)
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(
                    LinearGradient(
                        colors: [Theme.primary, Theme.primary.opacity(0.78)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)

            Toggle(isOn: $batterySaver) {
                HStack(spacing: 4) {
                    Image(systemName: "bolt.heart")
                        .font(.system(size: 9, weight: .heavy))
                    Text("Battery saver")
                        .font(.system(size: 10, weight: .semibold))
                }
                .foregroundStyle(Theme.mutedFg)
            }
            .toggleStyle(SwitchToggleStyle(tint: Theme.primary))
            .onChange(of: batterySaver) { _, v in
                UserDefaults.standard.set(v, forKey: "tp_watch_battery_saver")
            }

            Button(action: exitTraining) {
                Text("Exit")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Theme.mutedFg)
                    .frame(maxWidth: .infinity, minHeight: 24)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 8)
        .padding(.top, 6)
        .padding(.bottom, 4)
    }

    // MARK: - Active session screen ──────────────────────────────────────
    private var activeView: some View {
        ScrollView {
            VStack(spacing: 6) {
                HStack(spacing: 4) {
                    Text(state.trainingTitle.uppercased())
                        .font(.system(size: 10, weight: .heavy))
                        .tracking(0.6)
                        .foregroundStyle(Theme.primary)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    Text(elapsedString)
                        .font(.system(size: 12, weight: .heavy, design: .rounded))
                        .foregroundStyle(Theme.fg)
                        .monospacedDigit()
                }

                // Current exercise card — present whenever the phone
                // has pushed a workout exercise list. Falls back to the
                // generic HR readout for ride/strength/etc. sessions.
                if !state.trainingExercises.isEmpty,
                   state.trainingCurrentIdx < state.trainingExercises.count {
                    currentExerciseCard
                }

                // Big HR readout — primary metric for training.
                VStack(spacing: 0) {
                    Text(hrString)
                        .font(.system(size: batterySaver ? 26 : 34, weight: .heavy, design: .rounded))
                        .foregroundStyle(zoneColor)
                        .monospacedDigit()
                    Text("BPM · \(zoneLabel)")
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(0.4)
                        .foregroundStyle(Theme.mutedFg)
                }
                .frame(maxWidth: .infinity)

                // 5-zone HR strip — current zone highlights, others muted.
                if !batterySaver {
                    hrZoneStrip
                }

                Button(action: recordLap) {
                    Text("TAP TO LAP")
                        .font(.system(size: 10, weight: .heavy))
                        .tracking(0.6)
                        .foregroundStyle(Theme.mutedFg)
                        .frame(maxWidth: .infinity, minHeight: 30)
                        .background(Theme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)

                Button(action: finishSession) {
                    Text("FINISH")
                        .font(.system(size: 12, weight: .heavy))
                        .tracking(0.4)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 30)
                        .background(Color(red: 0.93, green: 0.27, blue: 0.27).opacity(0.9))
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 8)
            .padding(.top, 4)
            .padding(.bottom, 4)
        }
    }

    // MARK: - Current-exercise card ─────────────────────────────────────
    /// Displays the exercise the rider should be doing right now: name,
    /// set/total, reps or duration target, and a one-line coach hint.
    /// Phone-side timer drives the index/set; we just render whatever
    /// the latest snapshot says.
    private var currentExerciseCard: some View {
        let total = state.trainingExercises.count
        let idx = max(0, min(state.trainingCurrentIdx, total - 1))
        let ex = state.trainingExercises[idx]
        let nextEx: WatchTrainingExercise? = (idx + 1 < total) ? state.trainingExercises[idx + 1] : nil
        let setLabel = ex.setsTotal > 1
            ? "Set \(state.trainingCurrentSet + 1)/\(ex.setsTotal)"
            : ""
        let metaParts: [String] = [
            setLabel,
            ex.repsLabel.map { "\($0) reps" } ?? "",
            ex.durationLabel ?? "",
        ].filter { !$0.isEmpty }
        return VStack(alignment: .leading, spacing: 4) {
            Text("EXERCISE \(idx + 1)/\(total)")
                .font(.system(size: 9, weight: .heavy))
                .tracking(0.5)
                .foregroundStyle(Theme.mutedFg)
            Text(ex.name)
                .font(.system(size: 16, weight: .heavy))
                .foregroundStyle(Theme.fg)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
            if !metaParts.isEmpty {
                Text(metaParts.joined(separator: " · "))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.primary)
            }
            if let n = ex.notes, !n.isEmpty {
                Text(n)
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.mutedFg)
                    .lineLimit(2)
                    .padding(.top, 2)
            }
            if let next = nextEx {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.right")
                        .font(.system(size: 8, weight: .heavy))
                    Text("Next: \(next.name)")
                        .font(.system(size: 10, weight: .semibold))
                        .lineLimit(1)
                }
                .foregroundStyle(Theme.mutedFg)
                .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    // MARK: - HR zone strip ─────────────────────────────────────────────
    /// Five segments coloured by zone. Current zone gets a brighter fill;
    /// others render at 25% alpha. Reads the current %max-HR estimate from
    /// `zoneIndex` (1-based).
    private var hrZoneStrip: some View {
        HStack(spacing: 2) {
            ForEach(1...5, id: \.self) { z in
                Rectangle()
                    .fill(zoneFill(for: z))
                    .frame(maxWidth: .infinity, minHeight: 6, maxHeight: 6)
                    .clipShape(RoundedRectangle(cornerRadius: 2, style: .continuous))
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 2)
    }

    private func zoneFill(for z: Int) -> Color {
        let active = z == zoneIndex
        let base = zoneColor(for: z)
        return active ? base : base.opacity(0.22)
    }

    /// 1...5 from current HR vs 220-age max-HR. Falls back to zone 1 if no
    /// HR yet. Buckets: <60% Z1, 60-70 Z2, 70-80 Z3, 80-90 Z4, 90+ Z5.
    private var zoneIndex: Int {
        guard let hr = health.latestHeartRate, hr > 0 else { return 0 }
        // Default age 25 if iPhone hasn't pushed one — gives a sane max
        // for high-school athletes most of the time.
        let age: Int = 25
        let maxHR = max(120, 220 - age)
        let pct = Double(hr) / Double(maxHR)
        switch pct {
        case ..<0.60: return 1
        case ..<0.70: return 2
        case ..<0.80: return 3
        case ..<0.90: return 4
        default:      return 5
        }
    }

    private func zoneColor(for z: Int) -> Color {
        switch z {
        case 1: return Color(red: 0.42, green: 0.55, blue: 0.96) // blue
        case 2: return Color(red: 0.13, green: 0.77, blue: 0.36) // green
        case 3: return Color(red: 0.96, green: 0.62, blue: 0.04) // amber
        case 4: return Color(red: 0.97, green: 0.45, blue: 0.09) // orange
        case 5: return Color(red: 0.93, green: 0.27, blue: 0.27) // red
        default: return Theme.mutedFg
        }
    }

    private var zoneColor: Color { zoneColor(for: max(1, zoneIndex)) }
    private var zoneLabel: String {
        let z = zoneIndex
        return z == 0 ? "—" : "Z\(z)"
    }

    // MARK: - Computed strings ───────────────────────────────────────────
    private var hrString: String {
        guard let hr = health.latestHeartRate else { return "—" }
        return String(hr)
    }
    private var elapsedString: String {
        guard let start = state.trainingStartedAt else { return "0:00" }
        let secs = Int(now.timeIntervalSince(start))
        let h = secs / 3600
        let m = (secs % 3600) / 60
        let s = secs % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, s)
        }
        return String(format: "%d:%02d", m, s)
    }
    private var elapsedMinute: Int {
        guard let start = state.trainingStartedAt else { return 0 }
        return Int(now.timeIntervalSince(start)) / 60
    }

    // MARK: - Actions ────────────────────────────────────────────────────
    private func startSession() {
        WKInterfaceDevice.current().play(.start)
        state.trainingType = pendingType
        state.trainingLaps.removeAll()
        state.trainingStartedAt = Date()
        lastHapticMinute = 0
        Task {
            await session.start()
            health.startHeartRateStreaming()
        }
    }

    private func recordLap() {
        guard let started = state.trainingStartedAt else { return }
        WKInterfaceDevice.current().play(.click)
        let last = state.trainingLaps.first?.recordedAt ?? started
        let dur = Date().timeIntervalSince(last)
        let lap = WatchLap(number: state.trainingLaps.count + 1,
                           durationSeconds: dur,
                           recordedAt: Date())
        state.trainingLaps.insert(lap, at: 0)
    }

    private func finishSession() {
        WKInterfaceDevice.current().play(.success)
        let laps = state.trainingLaps
        let started = state.trainingStartedAt
        state.trainingActive = false
        state.trainingStartedAt = nil
        state.trainingLaps.removeAll()
        Task {
            _ = await session.end()
            health.stopHeartRateStreaming()
            if let started = started {
                let payload: [String: Any] = [
                    "startedAtMs": started.timeIntervalSince1970 * 1000,
                    "endedAtMs": Date().timeIntervalSince1970 * 1000,
                    "trainingType": state.trainingType,
                    "trainingTitle": state.trainingTitle,
                    "laps": laps.map { l in
                        [
                            "number": l.number,
                            "durationSeconds": l.durationSeconds,
                            "recordedAtMs": l.recordedAt.timeIntervalSince1970 * 1000,
                        ]
                    }
                ]
                ConnectivityService.shared.sendTrainingSessionEnd(payload)
            }
        }
    }

    private func exitTraining() {
        guard state.trainingStartedAt == nil else { return }
        WKInterfaceDevice.current().play(.success)
        state.trainingActive = false
    }
}

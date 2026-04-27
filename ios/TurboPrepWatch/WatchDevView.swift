import SwiftUI
import WatchKit

/// Dev / admin tab. Surfaces the controls a tester needs to exercise the
/// race-day pipeline without depending on the iPhone bridge or the
/// invisible long-press wordmark gesture.
///
/// This tab is intentionally simple and obvious — every action is its own
/// button labelled in plain English. If anything in race-day mode misbehaves
/// during a test, this is where the tester comes to reset state, add a fake
/// lap, or kick the sync to phone.
struct WatchDevView: View {
    @EnvironmentObject private var state: WatchAppState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("RACE DAY · TEST")
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(Theme.primary)
                    .padding(.top, 4)

                statusCard

                if state.raceDayActive {
                    Button(action: addTestLap) {
                        bigButtonLabel(icon: "plus.circle.fill", text: "Add test lap", tint: Theme.primary)
                    }
                    .buttonStyle(.plain)

                    Button(role: .destructive, action: endStint) {
                        bigButtonLabel(icon: "stop.fill", text: "End race day", tint: Theme.phasePeak)
                    }
                    .buttonStyle(.plain)
                } else {
                    Button(action: startStint) {
                        bigButtonLabel(icon: "flag.fill", text: "Start race day", tint: Theme.primary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 12)
        }
    }

    private var statusCard: some View {
        ThemeCard {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(state.raceDayActive ? Theme.phasePeak : Theme.mutedFg.opacity(0.5))
                        .frame(width: 6, height: 6)
                    Text(state.raceDayActive ? "RACE DAY LIVE" : "Idle")
                        .font(.system(size: 10, weight: .heavy))
                        .tracking(0.5)
                        .foregroundStyle(state.raceDayActive ? Theme.phasePeak : Theme.mutedFg)
                    Spacer()
                }
                if state.raceDayActive {
                    Text("\(state.raceDayLaps.count) lap\(state.raceDayLaps.count == 1 ? "" : "s") this stint")
                        .font(.system(.caption2))
                        .foregroundStyle(Theme.fg)
                }
                Text("\(state.pastStints.count) past stint\(state.pastStints.count == 1 ? "" : "s") on watch")
                    .font(.system(.caption2))
                    .foregroundStyle(Theme.mutedFg)
            }
        }
    }

    private func bigButtonLabel(icon: String, text: String, tint: Color) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .bold))
            Text(text)
                .font(.system(.body, weight: .heavy))
            Spacer(minLength: 0)
        }
        .foregroundStyle(.white)
        .padding(.vertical, 12)
        .padding(.horizontal, 14)
        .frame(maxWidth: .infinity)
        .background(tint)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    // MARK: - Actions

    private func startStint() {
        state.raceDayActive = true
        state.raceDayStartedAt = Date()
        state.raceDayLaps.removeAll()
        WKInterfaceDevice.current().play(.start)
    }

    private func endStint() {
        state.archiveCurrentStint()
        // Auto-sync newly archived stint to iPhone (best-effort; queues if
        // not reachable). Then clear in-progress state.
        if let last = state.pastStints.first, !last.synced {
            sendStintToPhone(last)
            state.markAllStintsSynced()
        }
        state.raceDayLaps.removeAll()
        state.raceDayActive = false
        state.raceDayStartedAt = nil
        WKInterfaceDevice.current().play(.stop)
    }

    private func addTestLap() {
        // Synthetic lap of a random 30–90 second duration. Useful for
        // exercising the lap-list UI and best-lap highlighting without
        // doing actual movement.
        let dur = Double.random(in: 30...90)
        state.recordLap(durationSeconds: dur)
        WKInterfaceDevice.current().play(.click)
    }

    private func sendStintToPhone(_ stint: WatchPastStint) {
        let payload: [String: Any] = [
            "stintId":      stint.id.uuidString,
            "stintStartedAt": stint.startedAt.timeIntervalSince1970,
            "stintEndedAt":   stint.endedAt.timeIntervalSince1970,
            "laps": stint.laps.map { lap in
                [
                    "number":     lap.number,
                    "duration":   Int(lap.durationSeconds * 1000),
                    "recordedAt": lap.recordedAt.timeIntervalSince1970,
                ] as [String: Any]
            },
        ]
        ConnectivityService.shared.sendRaceDayLaps(payload)
    }
}

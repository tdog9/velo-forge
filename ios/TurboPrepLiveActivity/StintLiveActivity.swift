import SwiftUI
import WidgetKit
import ActivityKit

/// Lock-screen + Dynamic Island UI for an in-flight race-day stint.
/// Reads from StintActivityAttributes (defined in Shared/) and uses
/// SwiftUI's Text(timerInterval:) to auto-tick the elapsed clock —
/// the host app only has to push state when laps / pits change.
@available(iOS 16.2, *)
struct StintLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: StintActivityAttributes.self) { context in
            // ── Lock-screen / banner UI ─────────────────────────────────
            lockScreenView(context: context)
                .padding(14)
                .activityBackgroundTint(Color.black)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                // ── Expanded ────────────────────────────────────────────
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 4) {
                            Image(systemName: "flag.checkered")
                                .font(.system(size: 11, weight: .heavy))
                                .foregroundStyle(orangePrimary)
                            Text("LAP \(context.state.lapCount)")
                                .font(.system(size: 11, weight: .heavy))
                                .tracking(0.4)
                                .foregroundStyle(orangePrimary)
                        }
                        Text(StintActivityFormat.lapTime(context.state.bestLapMs))
                            .font(.system(size: 20, weight: .heavy, design: .rounded))
                            .foregroundStyle(.white)
                            .monospacedDigit()
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("ELAPSED")
                            .font(.system(size: 9, weight: .heavy))
                            .tracking(0.4)
                            .foregroundStyle(.gray)
                        Text(timerInterval: context.state.stintStartedAt...futureDate, countsDown: false)
                            .font(.system(size: 20, weight: .heavy, design: .rounded))
                            .foregroundStyle(.white)
                            .monospacedDigit()
                            .multilineTextAlignment(.trailing)
                            .frame(width: 100, alignment: .trailing)
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    EmptyView()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        statPill(label: "LAPS",  value: "\(context.state.lapCount)")
                        statPill(label: "PITS",  value: "\(context.state.pitCount)")
                        statPill(label: "LAST",  value: StintActivityFormat.lapTime(context.state.lastLapMs))
                        Spacer()
                    }
                    .padding(.top, 4)
                }
            } compactLeading: {
                Image(systemName: "flag.checkered")
                    .foregroundStyle(orangePrimary)
            } compactTrailing: {
                Text(timerInterval: context.state.stintStartedAt...futureDate, countsDown: false)
                    .font(.system(size: 12, weight: .heavy, design: .rounded))
                    .monospacedDigit()
                    .frame(width: 50)
            } minimal: {
                Image(systemName: "flag.checkered")
                    .foregroundStyle(orangePrimary)
            }
            .keylineTint(orangePrimary)
        }
    }

    // MARK: - Lock-screen view ───────────────────────────────────────────
    @ViewBuilder
    private func lockScreenView(context: ActivityViewContext<StintActivityAttributes>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "flag.checkered")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(orangePrimary)
                Text("STINT · \(context.attributes.raceName)".uppercased())
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.5)
                    .foregroundStyle(orangePrimary)
                    .lineLimit(1)
                Spacer()
                Text(context.attributes.riderName)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.7))
                    .lineLimit(1)
            }
            HStack(alignment: .firstTextBaseline) {
                Text(timerInterval: context.state.stintStartedAt...futureDate, countsDown: false)
                    .font(.system(size: 36, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("BEST")
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(0.4)
                        .foregroundStyle(.gray)
                    Text(StintActivityFormat.lapTime(context.state.bestLapMs))
                        .font(.system(size: 18, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                }
            }
            HStack(spacing: 6) {
                statPill(label: "LAPS",  value: "\(context.state.lapCount)")
                statPill(label: "PITS",  value: "\(context.state.pitCount)")
                statPill(label: "LAST",  value: StintActivityFormat.lapTime(context.state.lastLapMs))
                Spacer()
            }
        }
    }

    private func statPill(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(.system(size: 9, weight: .heavy))
                .tracking(0.4)
                .foregroundStyle(.gray)
            Text(value)
                .font(.system(size: 14, weight: .heavy, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.white.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
    }

    /// SwiftUI's Text(timerInterval:) wants a closed range. We never
    /// want it to "complete", so push the upper bound far into the
    /// future and let the runtime auto-tick.
    private var futureDate: Date {
        Date().addingTimeInterval(60 * 60 * 24)
    }

    /// Brand orange — matches Theme.primary on the Watch.
    private var orangePrimary: Color {
        Color(red: 0xf9/255.0, green: 0x73/255.0, blue: 0x16/255.0)
    }
}

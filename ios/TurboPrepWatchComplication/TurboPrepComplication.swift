import WidgetKit
import SwiftUI

/// TurboPrep watch face complication.
///
/// Reads the latest race phase + days-out + today's plan summary from a
/// shared App Group container that the Watch app writes after each
/// state-snapshot push from the iPhone. The Widget itself is sandboxed
/// (no Firebase, no networking) — it just renders whatever the main
/// Watch app last cached.

private let appGroup = "group.com.403productions.turboprep"

// MARK: – Snapshot model written by the Watch app

struct ComplicationSnapshot {
    let phaseLabel: String      // BASE | BUILD | PEAK | TAPER | RACE WEEK
    let phaseAccent: String     // hex string for the phase colour
    let daysOut: Int            // days until next race
    let raceShortName: String   // "R1 Calder" etc
    let todayDoneCount: Int     // workouts completed today
    let todayTotalCount: Int    // total scheduled today

    static let placeholder = ComplicationSnapshot(
        phaseLabel: "BASE",
        phaseAccent: "#3b82f6",
        daysOut: 42,
        raceShortName: "Round 1",
        todayDoneCount: 0,
        todayTotalCount: 1
    )

    /// Read whatever the Watch app last cached into the shared App Group
    /// UserDefaults. Returns the placeholder if nothing's been written
    /// (first install) so the watch face never shows a blank tile.
    static func loadFromAppGroup() -> ComplicationSnapshot {
        guard let d = UserDefaults(suiteName: appGroup) else { return .placeholder }
        // If the Watch app hasn't pushed a snapshot yet, phaseLabel is
        // missing and we fall back to placeholder.
        guard let label = d.string(forKey: "tp_comp_phaseLabel") else { return .placeholder }
        return ComplicationSnapshot(
            phaseLabel: label,
            phaseAccent: d.string(forKey: "tp_comp_phaseAccent") ?? "#7a7d88",
            daysOut: d.integer(forKey: "tp_comp_daysOut"),
            raceShortName: d.string(forKey: "tp_comp_raceShortName") ?? "—",
            todayDoneCount: d.integer(forKey: "tp_comp_todayDoneCount"),
            todayTotalCount: d.integer(forKey: "tp_comp_todayTotalCount")
        )
    }
}

// MARK: – Timeline provider

struct TodayPhaseProvider: TimelineProvider {
    typealias Entry = TodayPhaseEntry

    func placeholder(in context: Context) -> TodayPhaseEntry {
        TodayPhaseEntry(date: Date(), snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayPhaseEntry) -> Void) {
        completion(TodayPhaseEntry(date: Date(), snapshot: ComplicationSnapshot.loadFromAppGroup()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayPhaseEntry>) -> Void) {
        // Single-entry timeline — the snapshot is refreshed by WidgetCenter
        // .reloadAllTimelines() on the Watch side whenever the iPhone pushes
        // new state. Reload again in 30 min as a fallback so countdowns
        // (days-out) stay current overnight.
        let entry = TodayPhaseEntry(date: Date(), snapshot: ComplicationSnapshot.loadFromAppGroup())
        let nextReload = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(nextReload)))
    }
}

struct TodayPhaseEntry: TimelineEntry {
    let date: Date
    let snapshot: ComplicationSnapshot
}

// MARK: – Views

private func accentColor(_ hex: String) -> Color {
    let h = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    guard h.count == 6, let v = UInt32(h, radix: 16) else { return .orange }
    let r = Double((v >> 16) & 0xff) / 255
    let g = Double((v >> 8) & 0xff) / 255
    let b = Double(v & 0xff) / 255
    return Color(red: r, green: g, blue: b)
}

/// Inline (single-line text on the watch face) — best for the Modular face.
struct InlineView: View {
    let entry: TodayPhaseEntry
    var body: some View {
        Text("\(entry.snapshot.phaseLabel) · \(entry.snapshot.daysOut)d")
    }
}

/// Circular small (ring around 1-2 chars) — Infograph corner.
struct CircularView: View {
    let entry: TodayPhaseEntry
    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 0) {
                Text("\(entry.snapshot.daysOut)")
                    .font(.system(size: 20, weight: .heavy, design: .rounded))
                    .minimumScaleFactor(0.6)
                Text("d")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.secondary)
            }
        }
    }
}

/// Rectangular (3-line text region) — Modular Ultra etc.
struct RectangularView: View {
    let entry: TodayPhaseEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: 4) {
                Circle()
                    .fill(accentColor(entry.snapshot.phaseAccent))
                    .frame(width: 6, height: 6)
                Text(entry.snapshot.phaseLabel)
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.4)
                    .foregroundStyle(accentColor(entry.snapshot.phaseAccent))
            }
            Text("\(entry.snapshot.daysOut)d to \(entry.snapshot.raceShortName)")
                .font(.system(.body, weight: .heavy))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if entry.snapshot.todayTotalCount > 0 {
                Text("Today \(entry.snapshot.todayDoneCount)/\(entry.snapshot.todayTotalCount)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            } else {
                Text("Rest day")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

/// Corner (curved single label) — Infograph corner of the Infograph face.
struct CornerView: View {
    let entry: TodayPhaseEntry
    var body: some View {
        Text("\(entry.snapshot.daysOut)d")
            .font(.system(size: 16, weight: .black, design: .rounded))
            .widgetCurvesContent()
            .widgetLabel {
                Text("\(entry.snapshot.phaseLabel) · \(entry.snapshot.raceShortName)")
            }
    }
}

@available(watchOS 10.0, *)
extension View {
    /// No-op on platforms that don't have the curve modifier — keeps the
    /// extension target compiling everywhere.
    @ViewBuilder
    func widgetCurvesContent() -> some View { self }
}

// MARK: – Widget definition

struct TurboPrepWidget: Widget {
    let kind = "TurboPrepWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodayPhaseProvider()) { entry in
            ContentView(entry: entry)
        }
        .configurationDisplayName("TurboPrep")
        .description("Race phase + days-out + today's plan progress.")
        .supportedFamilies([
            .accessoryInline,
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryCorner,
        ])
    }
}

struct ContentView: View {
    @Environment(\.widgetFamily) var family
    let entry: TodayPhaseEntry

    var body: some View {
        switch family {
        case .accessoryInline:      InlineView(entry: entry)
        case .accessoryCircular:    CircularView(entry: entry)
        case .accessoryRectangular: RectangularView(entry: entry)
        case .accessoryCorner:      CornerView(entry: entry)
        default:                    RectangularView(entry: entry)
        }
    }
}

// MARK: – Bundle entry point

@main
struct TurboPrepComplicationBundle: WidgetBundle {
    var body: some Widget {
        TurboPrepWidget()
    }
}

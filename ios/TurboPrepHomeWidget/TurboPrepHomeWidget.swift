import WidgetKit
import SwiftUI

/// Home-screen widget for TurboPrep.
///
/// Reads a snapshot the iPhone app last wrote to the shared App Group
/// (`group.com.403productions.turboprep`) — race phase + days-out + today's
/// plan completion. No networking, no Firebase: the widget is sandboxed
/// and just renders the most recent cached state.

private let appGroup = "group.com.403productions.turboprep"

// MARK: – Snapshot model written by the host app

struct HomeWidgetSnapshot {
    let phaseLabel: String      // BASE | BUILD | PEAK | RACE WEEK
    let phaseAccent: String     // hex string for the phase colour
    let daysOut: Int            // days until next race
    let raceShortName: String   // "R1 Calder" etc
    let todayDoneCount: Int     // workouts completed today
    let todayTotalCount: Int    // total scheduled today
    let todayTitle: String      // e.g. "Threshold intervals" or "Rest day"

    static let placeholder = HomeWidgetSnapshot(
        phaseLabel: "BASE",
        phaseAccent: "#3b82f6",
        daysOut: 42,
        raceShortName: "Round 1",
        todayDoneCount: 0,
        todayTotalCount: 1,
        todayTitle: "Threshold intervals"
    )

    static func loadFromAppGroup() -> HomeWidgetSnapshot {
        guard let d = UserDefaults(suiteName: appGroup) else { return .placeholder }
        guard let label = d.string(forKey: "tp_home_phaseLabel") else { return .placeholder }
        return HomeWidgetSnapshot(
            phaseLabel: label,
            phaseAccent: d.string(forKey: "tp_home_phaseAccent") ?? "#7a7d88",
            daysOut: d.integer(forKey: "tp_home_daysOut"),
            raceShortName: d.string(forKey: "tp_home_raceShortName") ?? "—",
            todayDoneCount: d.integer(forKey: "tp_home_todayDoneCount"),
            todayTotalCount: d.integer(forKey: "tp_home_todayTotalCount"),
            todayTitle: d.string(forKey: "tp_home_todayTitle") ?? "Rest day"
        )
    }
}

// MARK: – Timeline provider

struct HomeProvider: TimelineProvider {
    typealias Entry = HomeEntry

    func placeholder(in context: Context) -> HomeEntry {
        HomeEntry(date: Date(), snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (HomeEntry) -> Void) {
        completion(HomeEntry(date: Date(), snapshot: HomeWidgetSnapshot.loadFromAppGroup()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HomeEntry>) -> Void) {
        // Host app calls WidgetCenter.reloadAllTimelines() whenever it
        // pushes a fresh snapshot. Fallback reload at midnight so the
        // days-out countdown ticks over.
        let entry = HomeEntry(date: Date(), snapshot: HomeWidgetSnapshot.loadFromAppGroup())
        let nextMidnight = Calendar.current.nextDate(after: Date(), matching: DateComponents(hour: 0, minute: 1), matchingPolicy: .strict) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: [entry], policy: .after(nextMidnight)))
    }
}

struct HomeEntry: TimelineEntry {
    let date: Date
    let snapshot: HomeWidgetSnapshot
}

// MARK: – Colours

private func phaseColor(_ hex: String) -> Color {
    let h = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    guard h.count == 6, let v = UInt32(h, radix: 16) else { return .orange }
    let r = Double((v >> 16) & 0xff) / 255
    let g = Double((v >> 8) & 0xff) / 255
    let b = Double(v & 0xff) / 255
    return Color(red: r, green: g, blue: b)
}

private let orangePrimary = Color(red: 0xf9/255.0, green: 0x73/255.0, blue: 0x16/255.0)

// MARK: – Views

struct SmallView: View {
    let entry: HomeEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Circle()
                    .fill(phaseColor(entry.snapshot.phaseAccent))
                    .frame(width: 7, height: 7)
                Text(entry.snapshot.phaseLabel)
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(0.5)
                    .foregroundStyle(phaseColor(entry.snapshot.phaseAccent))
                Spacer()
            }
            Spacer(minLength: 0)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("\(entry.snapshot.daysOut)")
                    .font(.system(size: 44, weight: .heavy, design: .rounded))
                    .foregroundStyle(.primary)
                    .minimumScaleFactor(0.7)
                Text("d")
                    .font(.system(size: 18, weight: .heavy))
                    .foregroundStyle(.secondary)
            }
            Text(entry.snapshot.raceShortName)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Spacer(minLength: 0)
            progressRow
        }
        .containerBackground(.fill.tertiary, for: .widget)
    }

    private var progressRow: some View {
        HStack(spacing: 4) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 11, weight: .heavy))
                .foregroundStyle(orangePrimary)
            if entry.snapshot.todayTotalCount > 0 {
                Text("\(entry.snapshot.todayDoneCount)/\(entry.snapshot.todayTotalCount) today")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.secondary)
            } else {
                Text("Rest day")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
        }
    }
}

struct MediumView: View {
    let entry: HomeEntry
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 4) {
                    Circle()
                        .fill(phaseColor(entry.snapshot.phaseAccent))
                        .frame(width: 7, height: 7)
                    Text(entry.snapshot.phaseLabel)
                        .font(.system(size: 10, weight: .heavy))
                        .tracking(0.5)
                        .foregroundStyle(phaseColor(entry.snapshot.phaseAccent))
                }
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("\(entry.snapshot.daysOut)")
                        .font(.system(size: 56, weight: .heavy, design: .rounded))
                        .foregroundStyle(.primary)
                    Text("d")
                        .font(.system(size: 22, weight: .heavy))
                        .foregroundStyle(.secondary)
                }
                Text(entry.snapshot.raceShortName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            VStack(alignment: .leading, spacing: 6) {
                Text("TODAY")
                    .font(.system(size: 9, weight: .heavy))
                    .tracking(0.4)
                    .foregroundStyle(.secondary)
                Text(entry.snapshot.todayTitle)
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                Spacer(minLength: 0)
                if entry.snapshot.todayTotalCount > 0 {
                    HStack(spacing: 4) {
                        ForEach(0..<min(entry.snapshot.todayTotalCount, 6), id: \.self) { i in
                            RoundedRectangle(cornerRadius: 2, style: .continuous)
                                .fill(i < entry.snapshot.todayDoneCount ? orangePrimary : Color.secondary.opacity(0.25))
                                .frame(height: 6)
                        }
                    }
                    Text("\(entry.snapshot.todayDoneCount)/\(entry.snapshot.todayTotalCount) done")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                } else {
                    Text("Rest day")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

// MARK: – Lock-screen accessory variants

struct AccessoryInlineView: View {
    let entry: HomeEntry
    var body: some View {
        Text("\(entry.snapshot.phaseLabel) · \(entry.snapshot.daysOut)d")
    }
}

struct AccessoryCircularView: View {
    let entry: HomeEntry
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

struct AccessoryRectangularView: View {
    let entry: HomeEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: 4) {
                Circle()
                    .fill(phaseColor(entry.snapshot.phaseAccent))
                    .frame(width: 6, height: 6)
                Text(entry.snapshot.phaseLabel)
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.4)
                    .foregroundStyle(phaseColor(entry.snapshot.phaseAccent))
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

// MARK: – Widget definitions

struct TurboPrepHomeWidget: Widget {
    let kind = "TurboPrepHomeWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HomeProvider()) { entry in
            HomeContentView(entry: entry)
        }
        .configurationDisplayName("Race countdown")
        .description("Days to next race · current phase · today's plan.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryInline,
            .accessoryCircular,
            .accessoryRectangular,
        ])
    }
}

struct HomeContentView: View {
    @Environment(\.widgetFamily) var family
    let entry: HomeEntry

    var body: some View {
        switch family {
        case .systemSmall:          SmallView(entry: entry)
        case .systemMedium:         MediumView(entry: entry)
        case .accessoryInline:      AccessoryInlineView(entry: entry)
        case .accessoryCircular:    AccessoryCircularView(entry: entry)
        case .accessoryRectangular: AccessoryRectangularView(entry: entry)
        default:                    SmallView(entry: entry)
        }
    }
}

// MARK: – Bundle entry point

@main
struct TurboPrepHomeWidgetBundle: WidgetBundle {
    var body: some Widget {
        TurboPrepHomeWidget()
    }
}

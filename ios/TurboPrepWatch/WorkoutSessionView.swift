import SwiftUI

private enum SessionPhase {
    case idle
    case active
    case finished(WorkoutPayload)
}

struct WorkoutSessionView: View {
    @StateObject private var session = WorkoutSessionService()
    @Environment(\.dismiss) private var dismiss
    @State private var phase: SessionPhase = .idle

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 10) {
                    switch phase {
                    case .idle:    idleView
                    case .active:  activeView
                    case .finished(let payload): summaryView(payload)
                    }
                    if let err = session.lastError {
                        Text(err)
                            .font(.system(.caption2))
                            .foregroundStyle(Theme.phasePeak)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal, 4)
                .padding(.bottom, 12)
            }
        }
        .navigationTitle("HPV ride")
        .onChange(of: session.isActive) { _, nowActive in
            if nowActive { phase = .active }
        }
    }

    private var activeView: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Big elapsed timer — matches web's prominent "you've banked X min" rhythm.
            ThemeCard {
                VStack(alignment: .leading, spacing: 2) {
                    Text("ELAPSED")
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(0.6)
                        .foregroundStyle(Theme.mutedFg)
                    Text(formattedElapsed(session.elapsed))
                        .font(.system(size: 34, weight: .black, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(Theme.fg)
                }
            }

            ThemeCard {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 4) {
                        Image(systemName: "heart.fill")
                            .foregroundStyle(zoneColor(for: session.heartRate))
                            .font(.caption2)
                        Text(zoneLabel(for: session.heartRate).uppercased())
                            .font(.system(size: 9, weight: .heavy))
                            .tracking(0.6)
                            .foregroundStyle(zoneColor(for: session.heartRate))
                    }
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(session.heartRate.map(String.init) ?? "—")
                            .font(.system(size: 28, weight: .black, design: .rounded))
                            .foregroundStyle(zoneColor(for: session.heartRate))
                            .monospacedDigit()
                        Text("bpm")
                            .font(.system(.caption2))
                            .foregroundStyle(Theme.mutedFg)
                        if let max = session.heartRateMax, max > 0 {
                            Spacer()
                            Text("max \(max)")
                                .font(.system(.caption2))
                                .foregroundStyle(Theme.mutedFg)
                        }
                    }
                    if session.energyKcal > 0 {
                        Text("\(Int(session.energyKcal.rounded())) kcal banked")
                            .font(.system(.caption2))
                            .foregroundStyle(Theme.mutedFg)
                    }
                }
            }

            Button(role: .destructive) {
                Task {
                    let payload = await session.end()
                    if let payload {
                        phase = .finished(payload)
                    } else {
                        dismiss()
                    }
                }
            } label: {
                HStack {
                    Image(systemName: "stop.fill").font(.headline)
                    Text("End ride")
                        .font(.system(.body, weight: .bold))
                    Spacer(minLength: 0)
                }
                .foregroundStyle(.white)
                .padding(.vertical, 10)
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity)
                .background(Theme.phasePeak)
                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
            }
            .buttonStyle(.plain)
        }
    }

    private var idleView: some View {
        VStack(alignment: .leading, spacing: 10) {
            ThemeCard {
                VStack(alignment: .leading, spacing: 6) {
                    Text("READY")
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(0.6)
                        .foregroundStyle(Theme.mutedFg)
                    Text("HPV ride")
                        .font(.system(.title3, design: .rounded, weight: .bold))
                        .foregroundStyle(Theme.fg)
                    Text("Tap start when you're rolling. Heart rate and energy are recorded for the whole session.")
                        .font(.system(.caption2))
                        .foregroundStyle(Theme.mutedFg)
                }
            }
            Button {
                Task { await session.start() }
            } label: {
                HStack {
                    Image(systemName: "play.fill").font(.headline)
                    Text("Start ride")
                        .font(.system(.body, weight: .bold))
                    Spacer(minLength: 0)
                }
                .foregroundStyle(Theme.primaryFg)
                .padding(.vertical, 10)
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity)
                .background(Theme.primary)
                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
            }
            .buttonStyle(.plain)
        }
    }

    private func summaryView(_ p: WorkoutPayload) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Theme.primary)
                Text("RIDE COMPLETE")
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(Theme.primary)
            }
            ThemeCard {
                VStack(alignment: .leading, spacing: 6) {
                    Text("DURATION")
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(0.6)
                        .foregroundStyle(Theme.mutedFg)
                    Text(formattedElapsed(p.durationSeconds))
                        .font(.system(size: 28, weight: .black, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(Theme.fg)
                }
            }
            HStack(spacing: 8) {
                statTile(label: "AVG HR", value: p.heartRateAvg.map { "\($0)" } ?? "—", suffix: "bpm", color: Theme.heartRateColor)
                statTile(label: "MAX HR", value: p.heartRateMax.map { "\($0)" } ?? "—", suffix: "bpm", color: Theme.phasePeak)
            }
            if let kcal = p.energyKcal, kcal > 0 {
                ThemeCard {
                    HStack {
                        Text("ENERGY")
                            .font(.system(size: 9, weight: .heavy))
                            .tracking(0.6)
                            .foregroundStyle(Theme.mutedFg)
                        Spacer()
                        Text("\(Int(kcal.rounded())) kcal")
                            .font(.system(.body, design: .rounded, weight: .bold))
                            .foregroundStyle(Theme.fg)
                    }
                }
            }
            ThemeCard {
                Text("Saved to your phone — you'll see it in TurboPrep's Activities tab next time you open the app.")
                    .font(.system(.caption2))
                    .foregroundStyle(Theme.mutedFg)
            }
            Button {
                dismiss()
            } label: {
                HStack {
                    Text("Done")
                        .font(.system(.body, weight: .bold))
                    Spacer(minLength: 0)
                }
                .foregroundStyle(Theme.primaryFg)
                .padding(.vertical, 10)
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity)
                .background(Theme.primary)
                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
            }
            .buttonStyle(.plain)
        }
    }

    private func statTile(label: String, value: String, suffix: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 9, weight: .heavy))
                .tracking(0.6)
                .foregroundStyle(Theme.mutedFg)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(value)
                    .font(.system(size: 22, weight: .black, design: .rounded))
                    .foregroundStyle(color)
                    .monospacedDigit()
                Text(suffix)
                    .font(.system(size: 9))
                    .foregroundStyle(Theme.mutedFg)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                .stroke(Theme.border, lineWidth: 0.5)
        )
    }

    /// HR zones tuned for Y7–Y12 athletes. Zone 1 recovery → Zone 5 max.
    /// These are coarse defaults; future work can refine using restingHr.
    private func zoneColor(for bpm: Int?) -> Color {
        guard let bpm else { return Theme.fg }
        switch bpm {
        case ..<120:    return Theme.phaseBase      // Z1 recovery — green
        case 120..<140: return Theme.phaseBase      // Z2 aerobic — green
        case 140..<160: return Theme.phaseBuild     // Z3 tempo — amber
        case 160..<180: return Theme.phasePeak      // Z4 threshold — red
        default:        return Theme.phaseRaceWeek  // Z5 max — purple
        }
    }
    private func zoneLabel(for bpm: Int?) -> String {
        guard let bpm else { return "Heart rate" }
        switch bpm {
        case ..<120:    return "Z1 recovery"
        case 120..<140: return "Z2 aerobic"
        case 140..<160: return "Z3 tempo"
        case 160..<180: return "Z4 threshold"
        default:        return "Z5 max"
        }
    }

    private func formattedElapsed(_ t: TimeInterval) -> String {
        let total = Int(t)
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        return h > 0
            ? String(format: "%d:%02d:%02d", h, m, s)
            : String(format: "%d:%02d", m, s)
    }
}

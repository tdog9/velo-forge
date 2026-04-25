import SwiftUI

struct WorkoutSessionView: View {
    @StateObject private var session = WorkoutSessionService()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 10) {
                    if session.isActive {
                        activeView
                    } else {
                        idleView
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
                            .foregroundStyle(Theme.heartRateColor)
                            .font(.caption2)
                        Text("HEART RATE")
                            .font(.system(size: 9, weight: .heavy))
                            .tracking(0.6)
                            .foregroundStyle(Theme.mutedFg)
                    }
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(session.heartRate.map(String.init) ?? "—")
                            .font(.system(size: 28, weight: .black, design: .rounded))
                            .foregroundStyle(Theme.fg)
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
                    _ = await session.end()
                    dismiss()
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

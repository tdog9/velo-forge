import SwiftUI

struct WorkoutSessionView: View {
    @StateObject private var session = WorkoutSessionService()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 8) {
            if session.isActive {
                Text(formattedElapsed(session.elapsed))
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .monospacedDigit()
                if let bpm = session.heartRate {
                    HStack(spacing: 4) {
                        Image(systemName: "heart.fill").foregroundStyle(.red)
                        Text("\(bpm) bpm").font(.headline)
                    }
                }
                if session.energyKcal > 0 {
                    Text("\(Int(session.energyKcal)) kcal")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 4)
                Button(role: .destructive) {
                    Task {
                        _ = await session.end()
                        dismiss()
                    }
                } label: {
                    Label("End", systemImage: "stop.fill")
                        .frame(maxWidth: .infinity)
                }
            } else {
                Text("HPV ride").font(.headline)
                Text("Tap Start when you're ready to record.")
                    .font(.caption2)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)
                Button {
                    Task { await session.start() }
                } label: {
                    Label("Start", systemImage: "play.fill")
                        .frame(maxWidth: .infinity)
                }
                .tint(.green)
            }
            if let err = session.lastError {
                Text(err).font(.caption2).foregroundStyle(.red)
            }
        }
        .padding(.vertical, 6)
        .navigationTitle("Workout")
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

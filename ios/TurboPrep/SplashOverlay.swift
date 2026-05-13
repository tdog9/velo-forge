import SwiftUI
import Combine

/// Native splash overlay shown while the WebView loads turboprep.app.
/// Fades out once the bridge fires `WebLoaded`.
///
/// Adapts to the system colour scheme (light + dark) and uses a subtle
/// vertical brand gradient + a soft orange halo behind the logo for a
/// premium "boot" feel — instead of a flat dark slab.
struct SplashOverlay: View {
    @Binding var visible: Bool
    @Environment(\.colorScheme) private var scheme

    // Brand orange — matches Theme.primary on the watch + design-system.
    private let orange = Color(red: 0xf9/255, green: 0x73/255, blue: 0x16/255)

    var body: some View {
        ZStack {
            // ── Background gradient (theme-aware) ───────────────────────
            LinearGradient(
                colors: scheme == .dark
                    ? [
                        Color(red: 0x0c/255, green: 0x0d/255, blue: 0x14/255),
                        Color(red: 0x14/255, green: 0x0e/255, blue: 0x0a/255),
                    ]
                    : [
                        Color(red: 0xfa/255, green: 0xf9/255, blue: 0xf5/255),
                        Color(red: 0xff/255, green: 0xf2/255, blue: 0xe6/255),
                    ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            // ── Soft orange halo behind the mark ────────────────────────
            RadialGradient(
                colors: [orange.opacity(scheme == .dark ? 0.22 : 0.12), .clear],
                center: .center,
                startRadius: 4,
                endRadius: 220
            )
            .frame(width: 460, height: 460)
            .blur(radius: 24)
            .allowsHitTesting(false)

            VStack(spacing: 16) {
                // ── Logo tile ───────────────────────────────────────────
                ZStack {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [orange.opacity(0.95), orange],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 72, height: 72)
                    Text("T")
                        .font(.system(size: 42, weight: .black, design: .rounded))
                        .foregroundStyle(.white)
                }
                .shadow(color: orange.opacity(0.45), radius: 22, y: 6)

                // ── Wordmark (theme-aware foreground) ───────────────────
                HStack(spacing: 0) {
                    Text("Turbo")
                        .foregroundStyle(scheme == .dark
                            ? Color(red: 0xe8/255, green: 0xe5/255, blue: 0xde/255)
                            : Color(red: 0x14/255, green: 0x16/255, blue: 0x1c/255))
                    Text("Prep").foregroundStyle(orange)
                }
                .font(.system(size: 30, weight: .heavy, design: .rounded))

                // ── Tagline ─────────────────────────────────────────────
                Text("BUILT FOR RACE DAY")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(3)
                    .foregroundStyle(scheme == .dark
                        ? Color(red: 0x9b/255, green: 0x9d/255, blue: 0xa8/255)
                        : Color(red: 0x6a/255, green: 0x6d/255, blue: 0x78/255))

                // ── Loading hint dots ───────────────────────────────────
                LoadingDots(tint: orange)
                    .padding(.top, 6)
            }
        }
        .opacity(visible ? 1 : 0)
        .animation(.easeOut(duration: 0.4), value: visible)
        .allowsHitTesting(visible)
    }
}

// MARK: – Looping three-dot loader

private struct LoadingDots: View {
    let tint: Color
    @State private var phase: Double = 0
    // The publisher (not auto-connected) lets onAppear/onDisappear
    // explicitly start + stop the upstream subscription. The previous
    // .autoconnect() pattern leaked the timer forever — it kept firing
    // 5x/second after the splash dismissed.
    @State private var timerCancellable: Cancellable?

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<3) { i in
                Circle()
                    .fill(tint)
                    .frame(width: 6, height: 6)
                    .opacity(Int(phase) % 3 == i ? 1.0 : 0.25)
                    .scaleEffect(Int(phase) % 3 == i ? 1.15 : 0.85)
                    .animation(.easeInOut(duration: 0.15), value: phase)
            }
        }
        .onAppear {
            timerCancellable = Timer.publish(every: 0.18, on: .main, in: .common)
                .autoconnect()
                .sink { _ in phase += 1 }
        }
        .onDisappear {
            timerCancellable?.cancel()
            timerCancellable = nil
        }
    }
}

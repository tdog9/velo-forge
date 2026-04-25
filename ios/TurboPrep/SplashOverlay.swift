import SwiftUI

/// Native splash overlay shown while the WebView loads turboprep.app.
/// Fades out once the bridge fires `WebLoaded`. Matches the web's brand
/// header treatment (split-color wordmark on dark `--bg`).
struct SplashOverlay: View {
    @Binding var visible: Bool

    var body: some View {
        ZStack {
            Color(red: 0x0a/255, green: 0x0b/255, blue: 0x0f/255)
                .ignoresSafeArea()
            VStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color(red: 0xf9/255, green: 0x73/255, blue: 0x16/255))
                        .frame(width: 64, height: 64)
                    Text("T")
                        .font(.system(size: 38, weight: .black, design: .rounded))
                        .foregroundStyle(Color(red: 0x0d/255, green: 0x0e/255, blue: 0x12/255))
                }
                .shadow(color: Color(red: 0xf9/255, green: 0x73/255, blue: 0x16/255).opacity(0.35), radius: 18, y: 4)
                HStack(spacing: 0) {
                    Text("Turbo").foregroundStyle(Color(red: 0xe8/255, green: 0xe5/255, blue: 0xde/255))
                    Text("Prep").foregroundStyle(Color(red: 0xf9/255, green: 0x73/255, blue: 0x16/255))
                }
                .font(.system(size: 28, weight: .heavy, design: .rounded))
                Text("HPV RACE TRAINING")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(3)
                    .foregroundStyle(Color(red: 0x7a/255, green: 0x7d/255, blue: 0x88/255))
            }
        }
        .opacity(visible ? 1 : 0)
        .animation(.easeOut(duration: 0.35), value: visible)
        .allowsHitTesting(visible)
    }
}

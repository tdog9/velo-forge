import SwiftUI

/// Design tokens cloned from the web app's CSS custom properties (styles.css)
/// so the Watch UI feels like the same product. Update when the web tokens
/// move; the goal is visual parity, not invention.
enum Theme {
    // Surfaces — dark mode (web default)
    static let bg          = Color(red: 0x0a/255.0, green: 0x0b/255.0, blue: 0x0f/255.0)
    static let card        = Color(red: 0x11/255.0, green: 0x13/255.0, blue: 0x18/255.0)
    static let surface     = Color(red: 0x16/255.0, green: 0x19/255.0, blue: 0x20/255.0)
    static let raised      = Color(red: 0x1e/255.0, green: 0x21/255.0, blue: 0x28/255.0)

    // Text
    static let fg          = Color(red: 0xe8/255.0, green: 0xe5/255.0, blue: 0xde/255.0)
    static let mutedFg     = Color(red: 0x7a/255.0, green: 0x7d/255.0, blue: 0x88/255.0)

    // Borders
    static let border      = Color.white.opacity(0.07)
    static let borderStrong = Color.white.opacity(0.12)

    // Brand
    static let primary     = Color(red: 0xf9/255.0, green: 0x73/255.0, blue: 0x16/255.0)  // #f97316
    static let primaryFg   = Color(red: 0x0d/255.0, green: 0x0e/255.0, blue: 0x12/255.0)
    static let primaryDim  = Color(red: 0xf9/255.0, green: 0x73/255.0, blue: 0x16/255.0).opacity(0.12)

    // Phase colors (mirrors computeRacePhase in app.js)
    static let phaseBase     = Color(red: 0x22/255.0, green: 0xc5/255.0, blue: 0x5e/255.0)  // green
    static let phaseBuild    = Color(red: 0xf5/255.0, green: 0x9e/255.0, blue: 0x0b/255.0)  // amber
    static let phasePeak     = Color(red: 0xef/255.0, green: 0x44/255.0, blue: 0x44/255.0)  // red
    static let phaseTaper    = Color(red: 0x3b/255.0, green: 0x82/255.0, blue: 0xf6/255.0)  // blue
    static let phaseRaceWeek = Color(red: 0x8b/255.0, green: 0x5c/255.0, blue: 0xf6/255.0)  // purple

    // Health accents (matches web today health card)
    static let heartRateColor = Color(red: 0xef/255.0, green: 0x44/255.0, blue: 0x44/255.0)

    // Radii
    static let cornerRadius: CGFloat = 12
    static let cornerRadiusSmall: CGFloat = 8
}

/// Reusable card wrapper styled like the web's `.card` class.
struct ThemeCard<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .stroke(Theme.border, lineWidth: 0.5)
            )
    }
}

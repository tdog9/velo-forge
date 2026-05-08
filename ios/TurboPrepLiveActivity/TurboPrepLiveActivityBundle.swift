import SwiftUI
import WidgetKit
import ActivityKit

/// WidgetKit bundle entry point for the TurboPrep Live Activity
/// extension. Hosts every widget that ships with the extension —
/// today there's only the StintLiveActivity, future expansions
/// (workout-timer activity, race-day overall) hang off here.
@main
struct TurboPrepLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        if #available(iOS 16.2, *) {
            StintLiveActivity()
        }
    }
}

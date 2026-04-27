import Foundation
import CoreLocation
import Combine

/// Lightweight CoreLocation wrapper — surfaces current speed (m/s) for the
/// race-day lap timer. Activated only while the lap view is on screen so it
/// doesn't drain battery when not needed.
@MainActor
final class WatchLocationService: NSObject, ObservableObject {
    @Published var currentSpeedMps: Double?
    @Published var authorization: CLAuthorizationStatus = .notDetermined

    private let manager: CLLocationManager
    private var isActive = false

    override init() {
        self.manager = CLLocationManager()
        super.init()
        self.manager.delegate = self
        self.manager.desiredAccuracy = kCLLocationAccuracyBest
        self.manager.distanceFilter = 5      // metres — enough for lap-timer pace
        self.authorization = self.manager.authorizationStatus
    }

    func start() {
        guard !isActive else { return }
        isActive = true
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            manager.startUpdatingLocation()
        default:
            break
        }
    }

    func stop() {
        guard isActive else { return }
        isActive = false
        manager.stopUpdatingLocation()
        currentSpeedMps = nil
    }
}

extension WatchLocationService: CLLocationManagerDelegate {
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let s = manager.authorizationStatus
        Task { @MainActor in
            self.authorization = s
            if (s == .authorizedWhenInUse || s == .authorizedAlways) && self.isActive {
                self.manager.startUpdatingLocation()
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager,
                                     didUpdateLocations locations: [CLLocation]) {
        guard let last = locations.last else { return }
        // CoreLocation reports negative speed when invalid — gate to >= 0.
        let speed = last.speed >= 0 ? last.speed : 0
        Task { @MainActor in
            self.currentSpeedMps = speed
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Swallow — race day shouldn't crash because GPS hiccupped.
    }
}

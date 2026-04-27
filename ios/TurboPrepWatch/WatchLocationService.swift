import Foundation
import CoreLocation
import Combine

/// CoreLocation wrapper for the race-day lap timer. Surfaces:
///   - currentSpeedMps + currentCoord — for live HUD + mini-map dot
///   - track — recent positions for the polyline trail
///   - startFinishCoord — auto-detected start/finish point (lap detector)
///
/// Auto start/finish detection mirrors the iPhone's raceday.js logic:
///   - Athlete must move continuously for 7m30s, then current point is set
///   - OR: athlete returns to within 30m of the very first sampled point
///     after >60s of motion (closed-loop detection)
///
/// Activated only while the race-day lap view is on screen so it doesn't
/// drain battery when not needed.
@MainActor
final class WatchLocationService: NSObject, ObservableObject {
    @Published var currentSpeedMps: Double?
    @Published var currentCoord: CLLocationCoordinate2D?
    @Published var track: [CLLocationCoordinate2D] = []
    @Published var startFinishCoord: CLLocationCoordinate2D?
    @Published var authorization: CLAuthorizationStatus = .notDetermined

    private let manager: CLLocationManager
    private var isActive = false
    private var moveContinuousStart: Date?
    private var firstSampleAt: Date?

    private static let kLapThresholdM   = 30.0     // metres for "at the line"
    private static let kMinSpeedMps     = 0.3      // below = stopped
    private static let kAutoStartSecs   = 450.0    // 7m30s of continuous movement
    private static let kMaxTrackPoints  = 600      // cap to bound memory

    override init() {
        self.manager = CLLocationManager()
        super.init()
        self.manager.delegate = self
        self.manager.desiredAccuracy = kCLLocationAccuracyBest
        self.manager.distanceFilter = 5      // metres
        self.authorization = self.manager.authorizationStatus
    }

    func start() {
        guard !isActive else { return }
        isActive = true
        track = []
        moveContinuousStart = nil
        firstSampleAt = nil
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

    func clearStartFinish() {
        startFinishCoord = nil
        moveContinuousStart = nil
        firstSampleAt = nil
    }

    /// Distance in metres between the current position and the start/finish
    /// point. nil if either is missing. Used by the lap detector in the
    /// race-day view to fire a lap when the athlete crosses the line.
    func distanceToStartFinishM() -> Double? {
        guard let here = currentCoord, let line = startFinishCoord else { return nil }
        let a = CLLocation(latitude: here.latitude, longitude: here.longitude)
        let b = CLLocation(latitude: line.latitude, longitude: line.longitude)
        return a.distance(from: b)
    }

    // MARK: - Auto start/finish detection

    private func ingest(location loc: CLLocation) {
        let now = loc.timestamp
        let coord = loc.coordinate
        let speed = loc.speed >= 0 ? loc.speed : 0
        currentSpeedMps = speed
        currentCoord = coord
        track.append(coord)
        if track.count > Self.kMaxTrackPoints {
            track.removeFirst(track.count - Self.kMaxTrackPoints)
        }
        // Skip detection once already pinned.
        if startFinishCoord != nil { return }
        if firstSampleAt == nil { firstSampleAt = now }

        let moving = speed > Self.kMinSpeedMps
        if moving {
            if moveContinuousStart == nil { moveContinuousStart = now }
            if let started = moveContinuousStart,
               now.timeIntervalSince(started) >= Self.kAutoStartSecs {
                startFinishCoord = coord  // pin at the current position
                return
            }
        } else {
            moveContinuousStart = nil
        }

        // Closed-loop detection — athlete returned to first sampled point.
        if track.count > 20, let firstSample = track.first, let firstAt = firstSampleAt,
           now.timeIntervalSince(firstAt) > 60 {
            let here = CLLocation(latitude: coord.latitude, longitude: coord.longitude)
            let begin = CLLocation(latitude: firstSample.latitude, longitude: firstSample.longitude)
            if here.distance(from: begin) < Self.kLapThresholdM {
                startFinishCoord = firstSample
            }
        }
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
        Task { @MainActor in
            self.ingest(location: last)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Swallow — race day shouldn't crash because GPS hiccupped.
    }
}

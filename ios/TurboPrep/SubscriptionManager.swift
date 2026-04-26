import Foundation
import StoreKit
import FirebaseAuth
import FirebaseFirestore

/// StoreKit 2 subscription manager for TurboPrep Pro.
///
/// Inert until:
///   - You create products in App Store Connect with the Product IDs in
///     `Self.productIds`. Match these strings exactly when adding the IAP
///     records (My Apps → TurboPrep → Features → In-App Purchases).
///   - The TurboPrep target has the "In-App Purchase" capability enabled
///     in Signing & Capabilities (Xcode adds com.apple.InAppPurchase).
///   - You're running on a real device with a sandbox tester signed in to
///     iOS Settings → Developer → Sandbox Apple Account.
@MainActor
final class SubscriptionManager: ObservableObject {
    static let shared = SubscriptionManager()

    /// Product IDs registered in App Store Connect. Update these to match
    /// the exact strings you set when creating IAPs. Convention: reverse-DNS
    /// of the bundle identifier + plan suffix.
    static let productIds: [String] = [
        "com.403productions.turboprep.pro.monthly",
        "com.403productions.turboprep.pro.yearly",
    ]

    @Published private(set) var products: [Product] = []
    @Published private(set) var purchasedProductIds: Set<String> = []
    @Published private(set) var isLoadingProducts: Bool = false
    @Published private(set) var purchaseInProgress: Bool = false
    @Published var lastError: String?

    /// True when the user has any active TurboPrep Pro entitlement.
    var hasPro: Bool { !purchasedProductIds.isEmpty }

    private var transactionListenerTask: Task<Void, Never>?

    private init() {
        transactionListenerTask = Task.detached { [weak self] in
            for await update in StoreKit.Transaction.updates {
                await self?.handle(transactionResult: update)
            }
        }
    }

    deinit { transactionListenerTask?.cancel() }

    /// Fetch product metadata from App Store. Call from view .task.
    func loadProducts() async {
        guard products.isEmpty else { return }
        isLoadingProducts = true
        defer { isLoadingProducts = false }
        do {
            let fetched = try await Product.products(for: Self.productIds)
            // Sort cheapest term first — typically monthly < yearly in price.
            products = fetched.sorted { $0.price < $1.price }
            await refreshPurchasedState()
        } catch {
            lastError = "Couldn't load products: \(error.localizedDescription)"
        }
    }

    /// Initiate a purchase for the given product.
    func purchase(_ product: Product) async {
        purchaseInProgress = true
        defer { purchaseInProgress = false }
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                await handle(transactionResult: verification)
            case .userCancelled:
                break
            case .pending:
                lastError = "Purchase pending — Apple is reviewing or awaiting parental approval."
            @unknown default:
                lastError = "Unknown purchase outcome."
            }
        } catch {
            lastError = "Purchase failed: \(error.localizedDescription)"
        }
    }

    /// Restore Pro entitlement on a fresh install / new device.
    func restorePurchases() async {
        do {
            try await AppStore.sync()
            await refreshPurchasedState()
        } catch {
            lastError = "Restore failed: \(error.localizedDescription)"
        }
    }

    /// Walk all current entitlements and rebuild the purchasedProductIds set.
    func refreshPurchasedState() async {
        var owned: Set<String> = []
        for await result in StoreKit.Transaction.currentEntitlements {
            if case .verified(let txn) = result {
                owned.insert(txn.productID)
            }
        }
        purchasedProductIds = owned
        await syncEntitlementToFirestore()
    }

    private func handle(transactionResult: VerificationResult<StoreKit.Transaction>) async {
        guard case .verified(let txn) = transactionResult else { return }
        if txn.revocationDate == nil {
            purchasedProductIds.insert(txn.productID)
        } else {
            purchasedProductIds.remove(txn.productID)
        }
        await txn.finish()
        await syncEntitlementToFirestore()
    }

    /// Mirror the entitlement to Firestore so the web app + Watch see it
    /// without re-checking StoreKit. The Firestore rule should allow the
    /// owner to write users/{uid} merge { pro: ... }.
    private func syncEntitlementToFirestore() async {
        guard let uid = Auth.auth().currentUser?.uid else { return }
        let payload: [String: Any] = [
            "pro": [
                "active": hasPro,
                "products": Array(purchasedProductIds),
                "lastSync": FieldValue.serverTimestamp(),
                "platform": "ios",
            ]
        ]
        do {
            try await Firestore.firestore()
                .collection("users").document(uid)
                .setData(payload, merge: true)
        } catch {
            // Non-fatal: web can re-derive on next StoreKit query.
        }
    }
}

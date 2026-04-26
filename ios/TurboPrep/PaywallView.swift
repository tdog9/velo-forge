import SwiftUI
import StoreKit

/// TurboPrep Pro paywall. Designed to be presentable as a sheet from either
/// SwiftUI native screens or from the WebView (via the tpNative bridge in a
/// later commit). Visual aesthetic mirrors the web's dark + orange theme.
struct PaywallView: View {
    @StateObject private var subscriptions = SubscriptionManager.shared
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color(red: 10/255, green: 11/255, blue: 15/255).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header
                    bullets
                    productList
                    if let err = subscriptions.lastError {
                        Text(err).font(.footnote).foregroundStyle(.red)
                    }
                    actions
                    legalese
                }
                .padding(20)
            }
        }
        .preferredColorScheme(.dark)
        .task { await subscriptions.loadProducts() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("UPGRADE")
                .font(.system(size: 11, weight: .heavy)).tracking(0.6)
                .foregroundStyle(Color(red: 0xf9/255, green: 0x73/255, blue: 0x16/255))
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("Turbo").foregroundStyle(.white)
                Text("Prep")
                    .foregroundStyle(Color(red: 0xf9/255, green: 0x73/255, blue: 0x16/255))
                Text("Pro").foregroundStyle(.white).opacity(0.85)
            }
            .font(.system(size: 30, weight: .heavy, design: .rounded))
            Text("Coach mode, advanced metrics, and team tools.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var bullets: some View {
        VStack(alignment: .leading, spacing: 10) {
            bullet("AI Coach v2 — proactive race-week + recovery briefs")
            bullet("Live race-day Watch leaderboard for your team")
            bullet("Heart-rate zones + load curve trends")
            bullet("Plan ↔ race linking with auto-taper")
            bullet("Coach dashboard for monitoring all athletes")
        }
    }

    private func bullet(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(Color(red: 0xf9/255, green: 0x73/255, blue: 0x16/255))
            Text(text).foregroundStyle(.white).font(.subheadline)
        }
    }

    @ViewBuilder
    private var productList: some View {
        if subscriptions.isLoadingProducts {
            ProgressView().tint(Color(red: 0xf9/255, green: 0x73/255, blue: 0x16/255))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
        } else if subscriptions.products.isEmpty {
            Text("Subscription products are still being configured. Pro will be available shortly.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            VStack(spacing: 10) {
                ForEach(subscriptions.products, id: \.id) { product in
                    productRow(product)
                }
            }
        }
    }

    private func productRow(_ product: Product) -> some View {
        let isOwned = subscriptions.purchasedProductIds.contains(product.id)
        return Button {
            Task { await subscriptions.purchase(product) }
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(product.displayName)
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text(product.description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Spacer()
                Text(product.displayPrice)
                    .font(.system(.headline, design: .rounded, weight: .bold))
                    .foregroundStyle(Color(red: 0xf9/255, green: 0x73/255, blue: 0x16/255))
            }
            .padding(14)
            .background(Color(red: 0x16/255, green: 0x19/255, blue: 0x20/255))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(isOwned
                        ? Color(red: 0xf9/255, green: 0x73/255, blue: 0x16/255)
                        : Color.white.opacity(0.07),
                        lineWidth: isOwned ? 2 : 0.5)
            )
        }
        .buttonStyle(.plain)
        .disabled(subscriptions.purchaseInProgress)
    }

    private var actions: some View {
        VStack(spacing: 8) {
            Button {
                Task { await subscriptions.restorePurchases() }
            } label: {
                Text("Restore Purchases")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
            }
            Button {
                dismiss()
            } label: {
                Text("Not now")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var legalese: some View {
        Text("Subscriptions auto-renew until cancelled. Manage in Settings → Apple ID → Subscriptions.")
            .font(.caption2)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.leading)
    }
}

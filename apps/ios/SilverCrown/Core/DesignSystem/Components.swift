import SwiftUI

struct SCCard<Content: View>: View {
    var padding: CGFloat = Spacing.lg
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(ThemeColor.surfaceContainer)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .stroke(ThemeColor.outlineVariant.opacity(0.55), lineWidth: 1)
            )
    }
}

struct SCStatusChip: View {
    let text: String
    var color: Color = ThemeColor.primary

    var body: some View {
        Text(text)
            .font(SCFont.captionBold)
            .textCase(.uppercase)
            .tracking(0.4)
            .foregroundStyle(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(color.opacity(0.16))
            .clipShape(Capsule())
    }
}

struct SCScreenHeader: View {
    let title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(title.uppercased())
                .font(SCFont.screenTitle)
                .foregroundStyle(ThemeColor.primary)
                .tracking(2)
            if let subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(SCFont.subheadline)
                    .foregroundStyle(ThemeColor.onSurfaceVariant)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.lg)
        .padding(.top, Spacing.sm)
        .padding(.bottom, Spacing.md)
    }
}

struct SCEmptyState: View {
    let title: String
    var systemImage: String = "tray"
    var description: String? = nil
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: Spacing.lg) {
            Image(systemName: systemImage)
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(ThemeColor.primary.opacity(0.85))
            VStack(spacing: Spacing.sm) {
                Text(title)
                    .font(SCFont.headline)
                    .foregroundStyle(ThemeColor.onSurface)
                if let description {
                    Text(description)
                        .font(SCFont.subheadline)
                        .foregroundStyle(ThemeColor.onSurfaceVariant)
                        .multilineTextAlignment(.center)
                }
            }
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(SCPrimaryButtonStyle())
                    .frame(maxWidth: 220)
            }
        }
        .padding(Spacing.xl)
        .frame(maxWidth: .infinity)
    }
}

struct SCFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .font(SCFont.body())
            .padding(14)
            .background(ThemeColor.surfaceContainerHigh)
            .clipShape(RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
            .foregroundStyle(ThemeColor.onSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm, style: .continuous)
                    .stroke(ThemeColor.outlineVariant.opacity(0.7), lineWidth: 1)
            )
    }
}

struct SCPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(SCFont.button)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(ThemeColor.primary.opacity(configuration.isPressed ? 0.82 : 1))
            .foregroundStyle(ThemeColor.onPrimary)
            .clipShape(RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

struct SCSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(SCFont.button)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(ThemeColor.surfaceContainerHigh.opacity(configuration.isPressed ? 0.7 : 1))
            .foregroundStyle(ThemeColor.primary)
            .clipShape(RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm, style: .continuous)
                    .stroke(ThemeColor.outlineVariant, lineWidth: 1)
            )
    }
}

struct SCFilterBar<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            content()
        }
        .padding(Spacing.md)
        .background(ThemeColor.surfaceContainerLow)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
    }
}

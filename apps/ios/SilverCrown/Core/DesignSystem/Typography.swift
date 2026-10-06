import SwiftUI

enum SCFont {
    static func display(_ size: CGFloat) -> Font {
        .custom("BebasNeue-Regular", size: size)
    }

    static func body(_ size: CGFloat = 15, weight: Font.Weight = .regular) -> Font {
        switch weight {
        case .bold, .heavy, .black:
            return .custom("Montserrat-Bold", size: size)
        case .semibold, .medium:
            return .custom("Montserrat-SemiBold", size: size)
        default:
            return .custom("Montserrat-Regular", size: size)
        }
    }

    static let screenTitle = display(34)
    static let sectionTitle = display(22)
    static let headline = body(17, weight: .semibold)
    static let subheadline = body(14, weight: .regular)
    static let caption = body(12, weight: .regular)
    static let captionBold = body(11, weight: .semibold)
    static let button = body(16, weight: .semibold)
}

extension View {
    func scScreenTitle() -> some View {
        font(SCFont.screenTitle)
            .foregroundStyle(ThemeColor.primary)
            .tracking(2)
    }

    func scAppearFade(delay: Double = 0) -> some View {
        modifier(SCAppearFade(delay: delay))
    }
}

private struct SCAppearFade: ViewModifier {
    let delay: Double
    @State private var shown = false

    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown ? 0 : 8)
            .onAppear {
                withAnimation(.easeOut(duration: 0.35).delay(delay)) {
                    shown = true
                }
            }
    }
}

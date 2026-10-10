import SwiftUI
import WebKit

struct ChatLooraWebView: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.keyboardDismissMode = .interactive
        webView.customUserAgent = (webView.value(forKey: "userAgent") as? String ?? "") + " ChatLooraMobile/1.0"
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        private let allowedSuffixes = [
            "chatloora.com",
            "localhost",
            "tiktok.com",
            "facebook.com",
            "instagram.com",
            "google.com",
            "accounts.google.com",
            "wayl.io",
            "wayl.com",
            "whatsapp.com",
        ]

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            let scheme = url.scheme?.lowercased() ?? ""
            if scheme == "mailto" || scheme == "tel" || scheme == "whatsapp" {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }

            if scheme == "http" || scheme == "https" {
                let host = url.host?.lowercased() ?? ""
                let allowed = allowedSuffixes.contains { host == $0 || host.hasSuffix(".\($0)") }
                if allowed {
                    decisionHandler(.allow)
                } else {
                    UIApplication.shared.open(url)
                    decisionHandler(.cancel)
                }
                return
            }

            decisionHandler(.allow)
        }
    }
}

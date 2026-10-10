import SwiftUI

struct ContentView: View {
    private let startURL = URL(string: "https://www.chatloora.com/login")!

    var body: some View {
        ChatLooraWebView(url: startURL)
            .ignoresSafeArea(edges: .bottom)
            .background(Color(red: 15 / 255, green: 23 / 255, blue: 42 / 255))
    }
}

#Preview {
    ContentView()
}

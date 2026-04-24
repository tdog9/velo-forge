import SwiftUI

struct AuthView: View {
    @EnvironmentObject private var auth: AuthService
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            VStack(spacing: 6) {
                Text("TurboPrep").font(.largeTitle).bold()
                Text("Sign in with your TurboPrep account")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            VStack(spacing: 12) {
                TextField("Email", text: $email)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("Password", text: $password)
            }
            .textFieldStyle(.roundedBorder)
            if let err = auth.lastError {
                Text(err).font(.footnote).foregroundStyle(.red)
            }
            Button {
                Task { await auth.signIn(email: email, password: password) }
            } label: {
                Group {
                    if auth.isAuthenticating {
                        ProgressView().tint(.white)
                    } else {
                        Text("Sign in").bold()
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .disabled(auth.isAuthenticating || email.isEmpty || password.isEmpty)
            Spacer()
        }
        .padding(24)
    }
}

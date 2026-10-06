import SwiftUI
import PhotosUI
import UIKit

struct CameraPicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        picker.delegate = context.coordinator
        picker.allowsEditing = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            parent.image = info[.originalImage] as? UIImage
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

struct DefectPhotoButton: View {
    let title: String
    @Binding var image: UIImage?
    @State private var showCamera = false
    @State private var pickerItem: PhotosPickerItem?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(maxWidth: .infinity)
                    .frame(height: 140)
                    .clipped()
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                HStack {
                    Button("Retake") { showCamera = true }
                    Button("Remove", role: .destructive) { self.image = nil }
                }
                .font(.caption)
            } else {
                HStack(spacing: 12) {
                    Button {
                        showCamera = true
                    } label: {
                        Label("Camera", systemImage: "camera")
                    }
                    PhotosPicker(selection: $pickerItem, matching: .images) {
                        Label("Library", systemImage: "photo")
                    }
                }
                .font(.caption)
                Text("Photo required for \(title) defect documentation is recommended.")
                    .font(.caption2)
                    .foregroundStyle(ThemeColor.onSurfaceVariant)
            }
        }
        .sheet(isPresented: $showCamera) {
            CameraPicker(image: $image)
                .ignoresSafeArea()
        }
        .onChange(of: pickerItem) { _, item in
            Task {
                guard let item,
                      let data = try? await item.loadTransferable(type: Data.self),
                      let ui = UIImage(data: data)
                else { return }
                image = ui
            }
        }
    }
}

struct RemotePhotoView: View {
    let urlString: String
    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 180)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                ProgressView()
                    .frame(height: 80)
            }
        }
        .task {
            guard let url = URL(string: urlString) else { return }
            if let (data, _) = try? await URLSession.shared.data(from: url),
               let ui = UIImage(data: data) {
                image = ui
            }
        }
    }
}

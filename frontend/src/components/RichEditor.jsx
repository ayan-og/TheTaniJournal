import React, { useRef, useMemo } from "react";
import ReactQuill, { Quill } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import api from "@/lib/api";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "blockquote"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link", "image"],
  ["clean"],
];

export default function RichEditor({ value, onChange, placeholder = "Start writing your thoughts…" }) {
  const ref = useRef(null);

  const imageHandler = () => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/jpeg,image/png,image/webp,image/gif");
    input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be under 5MB");
        return;
      }
      const editor = ref.current?.getEditor?.();
      const range = editor?.getSelection(true);
      const placeholderId = `uploading-${Date.now()}`;
      // Insert a temporary marker
      try {
        editor.insertText(range?.index ?? 0, "⏳ uploading image…", "italic", true);
      } catch { /* editor not ready yet */ }
      try {
        const form = new FormData();
        form.append("file", file);
        const { data } = await api.post("/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
        // Remove the placeholder text we just inserted
        try { editor.deleteText(range?.index ?? 0, "⏳ uploading image…".length); } catch { /* noop */ }
        const url = `${BACKEND_URL}${data.url}`;
        editor.insertEmbed(range?.index ?? 0, "image", url, "user");
        editor.setSelection((range?.index ?? 0) + 1, 0);
        // Mark image for sanitization-safe rendering (no extra attrs needed)
        void placeholderId;
      } catch (err) {
        try { editor.deleteText(range?.index ?? 0, "⏳ uploading image…".length); } catch { /* noop */ }
        toast.error(err.response?.data?.detail || "Image upload failed");
      }
    };
  };

  const modules = useMemo(
    () => ({
      toolbar: { container: TOOLBAR, handlers: { image: imageHandler } },
    }),
    [],
  );

  return (
    <div data-testid="rich-editor">
      <ReactQuill
        ref={ref}
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={modules}
      />
    </div>
  );
}

import React, { useRef } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "blockquote"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link"],
  ["clean"],
];

const QUILL_MODULES = { toolbar: TOOLBAR };

export default function RichEditor({ value, onChange, placeholder = "Start writing your thoughts…" }) {
  const ref = useRef(null);
  return (
    <div data-testid="rich-editor">
      <ReactQuill
        ref={ref}
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={QUILL_MODULES}
      />
    </div>
  );
}

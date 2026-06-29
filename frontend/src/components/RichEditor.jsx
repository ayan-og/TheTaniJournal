import React, { useEffect, useRef } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "blockquote"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link"],
  ["clean"],
];

export default function RichEditor({ value, onChange, placeholder = "Start writing your thoughts…" }) {
  const ref = useRef(null);
  useEffect(() => {
    // Force consistent font on render
  }, []);
  return (
    <div data-testid="rich-editor">
      <ReactQuill
        ref={ref}
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={{ toolbar: TOOLBAR }}
      />
    </div>
  );
}

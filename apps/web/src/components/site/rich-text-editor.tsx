"use client"

import { useEffect } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"

type Props = {
    value: any
    onChange: (value: any) => void
}

export function RichTextEditor({ value, onChange }: Props) {
    const editor = useEditor({
        extensions: [StarterKit],
        content: value || { type: "doc", content: [{ type: "paragraph" }] },
        editorProps: {
            attributes: {
                class: "min-h-[180px] rounded-md border border-white/15 bg-white/[0.03] p-3 text-sm text-white outline-none",
            },
        },
        onUpdate({ editor: ed }) {
            onChange(ed.getJSON())
        },
    })

    useEffect(() => {
        if (!editor) return
        if (!value) return
        const current = editor.getJSON()
        if (JSON.stringify(current) !== JSON.stringify(value)) {
            editor.commands.setContent(value, { emitUpdate: false })
        }
    }, [editor, value])

    return (
        <div className="space-y-2">
            <div className="flex gap-2 text-xs text-white/60">
                <button type="button" className="rounded border border-white/20 px-2 py-1" onClick={() => editor?.chain().focus().toggleBold().run()}>B</button>
                <button type="button" className="rounded border border-white/20 px-2 py-1 italic" onClick={() => editor?.chain().focus().toggleItalic().run()}>I</button>
                <button type="button" className="rounded border border-white/20 px-2 py-1" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
                <button type="button" className="rounded border border-white/20 px-2 py-1" onClick={() => editor?.chain().focus().toggleBulletList().run()}>• List</button>
            </div>
            <EditorContent editor={editor} />
        </div>
    )
}

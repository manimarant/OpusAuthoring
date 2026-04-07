import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon,
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify,
  List,
  ListOrdered,
  Link as LinkIcon,
  Heading2,
  Undo
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  editorContentClassName?: string;
  toolbarExtras?: React.ReactNode;
  suppressToolbar?: boolean;
}

export default function RichTextEditor({ 
  content, 
  onChange, 
  onFocus,
  onBlur,
  placeholder = "Start typing...",
  className,
  editorContentClassName,
  toolbarExtras,
  suppressToolbar = false,
}: RichTextEditorProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number; visible: boolean }>({
    top: 0,
    left: 0,
    visible: false,
  });
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Link.configure({
        openOnClick: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onFocus: () => {
      setIsFocused(true);
      onFocus?.();
    },
    onBlur: () => {
      setIsFocused(false);
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class: cn(
          'rise-content rise-rich-editor prose prose-slate max-w-none focus:outline-none min-h-[32px] px-0 py-0 text-[15px] leading-7 [&_h2]:text-[1.65rem] [&_h2]:font-semibold [&_h2]:tracking-tight [&_p]:my-0.5 [&_ul]:my-0.5 [&_ol]:my-0.5',
          editorContentClassName,
        ),
      },
    },
  });

  // Update editor content when the content prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const updateToolbarPosition = () => {
      if (!editor.isFocused || !wrapperRef.current) {
        setToolbarPosition((prev) => ({ ...prev, visible: false }));
        return;
      }

      const { from, to } = editor.state.selection;
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const selectionCenter = from === to
        ? start.left
        : start.left + Math.max(end.right - start.left, 0) / 2;
      const estimatedToolbarWidth = toolbarExtras ? 560 : 500;
      const estimatedToolbarHeight = 48;
      const nextLeft = Math.min(
        Math.max(selectionCenter - estimatedToolbarWidth / 2, 12),
        window.innerWidth - estimatedToolbarWidth - 12,
      );
      const preferredTop = start.top - estimatedToolbarHeight - 16;
      const shouldPlaceBelow = preferredTop < wrapperRect.top + 8;
      const nextTop = shouldPlaceBelow
        ? Math.min(start.bottom + 12, window.innerHeight - estimatedToolbarHeight - 12)
        : preferredTop;

      setToolbarPosition({
        top: nextTop,
        left: nextLeft,
        visible: true,
      });
    };

    const hideToolbar = () => {
      setToolbarPosition((prev) => ({ ...prev, visible: false }));
    };

    updateToolbarPosition();
    editor.on('focus', updateToolbarPosition);
    editor.on('selectionUpdate', updateToolbarPosition);
    editor.on('transaction', updateToolbarPosition);
    editor.on('blur', hideToolbar);
    window.addEventListener('resize', updateToolbarPosition);
    window.addEventListener('scroll', updateToolbarPosition, true);

    return () => {
      editor.off('focus', updateToolbarPosition);
      editor.off('selectionUpdate', updateToolbarPosition);
      editor.off('transaction', updateToolbarPosition);
      editor.off('blur', hideToolbar);
      window.removeEventListener('resize', updateToolbarPosition);
      window.removeEventListener('scroll', updateToolbarPosition, true);
    };
  }, [editor, toolbarExtras]);

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({ 
    onClick, 
    isActive = false, 
    children, 
    title 
  }: { 
    onClick: () => void; 
    isActive?: boolean; 
    children: React.ReactNode;
    title: string;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        "h-8 w-8 rounded-full p-0 text-slate-700 hover:bg-slate-200 hover:text-slate-900 font-bold",
        isActive && "bg-slate-900 text-white hover:bg-slate-900 hover:text-white"
      )}
      title={title}
      type="button"
    >
      {children}
    </Button>
  );

  return (
    <div ref={wrapperRef} className={cn("rise-shell rise-editor-surface rise-rich-editor relative rounded-2xl border border-slate-200 bg-white px-5 py-1", className)}>
      {isFocused && toolbarPosition.visible && !suppressToolbar && (
        <div
          className="fixed z-50 flex flex-wrap items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
          style={{ top: toolbarPosition.top, left: toolbarPosition.left }}
        >
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-6 w-px bg-slate-200" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            title="Heading"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            title="Underline"
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-6 w-px bg-slate-200" />

          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            isActive={editor.isActive({ textAlign: 'left' })}
            title="Align Left"
          >
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            isActive={editor.isActive({ textAlign: 'center' })}
            title="Align Center"
          >
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            isActive={editor.isActive({ textAlign: 'right' })}
            title="Align Right"
          >
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            isActive={editor.isActive({ textAlign: 'justify' })}
            title="Justify"
          >
            <AlignJustify className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-6 w-px bg-slate-200" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-6 w-px bg-slate-200" />

          <ToolbarButton
            onClick={() => {
              const url = window.prompt('Enter URL');
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }}
            isActive={editor.isActive('link')}
            title="Add Link"
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>

          {toolbarExtras ? (
            <>
              <div className="w-px h-6 bg-border mx-1" />
              
              {toolbarExtras}
            </>
          ) : null}
        </div>
      )}
      
      <EditorContent editor={editor} />
    </div>
  );
}

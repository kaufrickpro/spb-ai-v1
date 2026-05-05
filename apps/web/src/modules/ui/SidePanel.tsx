import { useEffect } from "react";
import { X } from "lucide-react";

type Props = {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function SidePanel({ title, isOpen, onClose, children }: Props) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md transform transition-all bg-white shadow-xl flex flex-col h-full overflow-y-scroll">
          <div className="px-4 py-6 sm:px-6 flex items-start justify-between border-b border-slate-200 sticky top-0 bg-white z-10">
            <h2 className="text-lg font-semibold leading-6 text-slate-900">
              {title}
            </h2>
            <button
              type="button"
              className="relative rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 p-2 -m-2 transition-colors"
              onClick={onClose}
            >
              <span className="sr-only">Close panel</span>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="relative flex-1 px-4 py-6 sm:px-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

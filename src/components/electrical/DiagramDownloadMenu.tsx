import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@pacific-code-labs/sokol-design-system";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LangContext";

export type DiagramFormat = "pdf" | "png" | "svg";

export function DiagramDownloadMenu({ busy, disabled, onDownload }: { busy: boolean; disabled?: boolean; onDownload: (format: DiagramFormat) => void }) {
  const { tr } = useLang();
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm" disabled={busy || disabled}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
      {tr.elec_download}<ChevronDown className="ml-2 h-3.5 w-3.5" />
    </Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={() => onDownload("pdf")}>{tr.elec_download_pdf}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onDownload("png")}>{tr.elec_download_png}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onDownload("svg")}>{tr.elec_download_svg}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

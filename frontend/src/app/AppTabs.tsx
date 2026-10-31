import { FolderOpen, Images, Upload } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Page } from "./route.ts"

const TABS: { page: Page; label: string; href: string; Icon: LucideIcon }[] = [
  { page: "photos", label: "Photos", href: "#/photos", Icon: Images },
  { page: "albums", label: "Albums", href: "#/", Icon: FolderOpen },
  { page: "upload", label: "Upload", href: "#/upload", Icon: Upload },
]

export function AppTabs({ active }: { active: Page }) {
  return (
    <nav className="app-tabs" aria-label="Main">
      {TABS.map(({ page, label, href, Icon }) => (
        <a
          key={page}
          href={href}
          className={`app-tab${active === page ? " is-active" : ""}`}
          aria-current={active === page ? "page" : undefined}
        >
          <Icon size={16} aria-hidden="true" />
          {label}
        </a>
      ))}
    </nav>
  )
}

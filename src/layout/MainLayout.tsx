import { useEffect, useMemo, useState, type ReactNode } from "react";
import clsx from "clsx";
import {
  Activity,
  BarChart3,
  ChartSpline,
  ChevronDown,
  Crosshair,
  Dna,
  FolderCog,
  LayoutGrid,
  Settings2,
  Waypoints
} from "lucide-react";
import { ConsoleDock } from "@/components/shared/ConsoleDock";
import { SITE_NAV_CHILDREN } from "@/modules/SiteProfile/siteModuleDefinitions";
import { useLogStore } from "@/store/useLogStore";

interface NavChildItem {
  id: string;
  label: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: typeof Activity;
  children?: NavChildItem[];
}

const navItems: NavItem[] = [
  { id: "setup", label: "Project Configuration", icon: Settings2 },
  { id: "upload-run", label: "Upload / Run", icon: FolderCog },
  { id: "meta-plot", label: "Meta Plot", icon: ChartSpline },
  { id: "peak-distribution", label: "Peak Distribution", icon: BarChart3 },
  {
    id: "gene-statistics",
    label: "Gene Statistics",
    icon: Dna,
    children: [
      { id: "gene-type", label: "Gene Type" },
      { id: "peak-gene-size", label: "Peak Gene Size" },
      { id: "gene-matrix", label: "Gene Matrix" }
    ]
  },
  {
    id: "exon-statistics",
    label: "Exon Statistics",
    icon: Waypoints,
    children: [
      { id: "peak-exon-size", label: "Peak Exon Size" },
      { id: "peak-exon-type", label: "Peak Exon Type" },
      { id: "peak-exon-num", label: "Peak Exon Num" }
    ]
  },
  {
    id: "site",
    label: "Site",
    icon: Crosshair,
    children: SITE_NAV_CHILDREN
  }
];

interface MainLayoutProps {
  activeModule: string;
  onModuleChange: (moduleId: string) => void;
  children: ReactNode;
}

export function MainLayout({
  activeModule,
  onModuleChange,
  children
}: MainLayoutProps) {
  const { activeProcessCount } = useLogStore();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "gene-statistics": false,
    "exon-statistics": false,
    site: false
  });
  const activeItem = useMemo(
    () =>
      navItems
        .flatMap((item) => [item, ...(item.children ?? [])])
        .find((item) => item.id === activeModule),
    [activeModule]
  );

  useEffect(() => {
    const activeParent = navItems.find((item) =>
      item.children?.some((child) => child.id === activeModule)
    );

    if (activeParent) {
      setOpenGroups((current) => ({
        ...current,
        [activeParent.id]: true
      }));
    }
  }, [activeModule]);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <span>RNAmeta</span>
        </div>

        <nav className="app-sidebar__nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isParentActive = Boolean(
              item.children?.some((child) => child.id === activeModule)
            );

            if (item.children) {
              const isOpen = Boolean(openGroups[item.id]);
              const toggleOpen = () =>
                setOpenGroups((current) => ({
                  ...current,
                  [item.id]: !current[item.id]
                }));

              return (
                <div
                  key={item.id}
                  className={clsx("nav-group", {
                    "is-open": isOpen,
                    "has-active-child": isParentActive
                  })}
                >
                  <button
                    type="button"
                    className={clsx("nav-item", "nav-item--group-trigger", {
                      "is-active": isParentActive || activeModule === item.id
                    })}
                    onClick={toggleOpen}
                  >
                    <span className="nav-item__rail" />
                    <span className="nav-item__content">
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </span>
                    <ChevronDown className="nav-group__chevron" size={15} />
                  </button>

                  {isOpen ? (
                    <div className="nav-group__children">
                      {item.children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          className={clsx("nav-subitem", {
                            "is-active": activeModule === child.id
                          })}
                          onClick={() => onModuleChange(child.id)}
                        >
                          <span>{child.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                className={clsx("nav-item", {
                  "is-active": activeModule === item.id || isParentActive
                })}
                onClick={() => onModuleChange(item.id)}
              >
                <span className="nav-item__rail" />
                <span className="nav-item__content">
                  <Icon size={16} />
                  <span>{item.label}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="app-sidebar__status">
          <span className={clsx("status-dot", { "is-busy": activeProcessCount > 0 })} />
          {activeProcessCount > 0 ? "Engine Active" : "Engine Ready"}
        </div>
      </aside>

      <div className="app-workspace">
        <header className="app-workspace__header">
          <div className="workspace-breadcrumb">
            <LayoutGrid size={12} />
            <span>Workspace / </span>
            <strong>{activeItem?.label ?? "Module"}</strong>
          </div>
        </header>

        <main className="app-workspace__main">
          <div className="app-workspace__inner">{children}</div>
        </main>

        <ConsoleDock />
      </div>
    </div>
  );
}

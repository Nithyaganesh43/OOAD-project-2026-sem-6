import { useEffect, useMemo, useState } from 'react'
import AppHeader from './AppHeader'

const DashboardShell = ({ title, subtitle, sections, children }) => {
  const [activeSection, setActiveSection] = useState(sections[0]?.id || '')

  const sectionIds = useMemo(() => sections.map((section) => section.id), [sections])

  useEffect(() => {
    if (!sectionIds.length) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)

        if (visible[0]?.target?.id) {
          setActiveSection(visible[0].target.id)
        }
      },
      {
        threshold: [0.2, 0.45, 0.7],
        rootMargin: '-15% 0px -55% 0px',
      },
    )

    sectionIds.forEach((id) => {
      const element = document.getElementById(id)

      if (element) {
        observer.observe(element)
      }
    })

    return () => observer.disconnect()
  }, [sectionIds])

  return (
    <div className="app-shell">
      <AppHeader title={title} subtitle={subtitle} />

      <div className="workspace-shell">
        <aside className="workspace-sidebar">
          <div className="sidebar-panel">
            <p className="sidebar-label">Workspace</p>
            <h2>{title}</h2>
            <p className="muted">{subtitle}</p>
          </div>

          <nav className="section-nav" aria-label="Dashboard sections">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={activeSection === section.id ? 'section-link active' : 'section-link'}
                onClick={() => setActiveSection(section.id)}
              >
                <span>{section.label}</span>
                <small>{section.description}</small>
              </a>
            ))}
          </nav>
        </aside>

        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}

export default DashboardShell

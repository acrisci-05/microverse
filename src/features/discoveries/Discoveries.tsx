import { LockKeyhole, Sparkles } from 'lucide-react'
import { ACHIEVEMENTS } from '../../data/ecology'
import { achievementIcons } from '../../data/iconMaps'
import type { WorldRecord } from '../../types/world'

export function Discoveries({
  worlds,
  onCreate,
  onOpen,
}: {
  worlds: WorldRecord[]
  onCreate: () => void
  onOpen: (id: string) => void
}) {
  const discovered = new Set(worlds.flatMap((world) => world.achievements))
  return (
    <main id="main" className="discoveries page-enter section-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">THE UNIVERSE REWARDS CURIOSITY</p>
          <h1>
            Small worlds.
            <br />
            <span>Remarkable discoveries.</span>
          </h1>
          <p>Find balance. Weather a crisis. Give life a second chance.</p>
        </div>
        <div className="discovery-total">
          <Sparkles size={22} />
          <strong>
            {discovered.size}
            <span>/ {ACHIEVEMENTS.length}</span>
          </strong>
          <span>DISCOVERED</span>
        </div>
      </div>
      <div className="discovery-grid">
        {ACHIEVEMENTS.map((achievement, index) => {
          const Icon = achievementIcons[achievement.icon]
          const earnedBy = worlds.filter((world) => world.achievements.includes(achievement.id))
          const unlocked = earnedBy.length > 0
          return (
            <article
              key={achievement.id}
              className={`discovery-card ${unlocked ? 'unlocked' : ''}`}
            >
              <div className="discovery-card-top">
                <span className="eyebrow">DISCOVERY 0{index + 1}</span>
                {unlocked ? (
                  <span className="unlocked-label">DISCOVERED</span>
                ) : (
                  <LockKeyhole size={15} />
                )}
              </div>
              <div className="achievement-medallion">
                <Icon size={34} />
              </div>
              <h2>{achievement.name}</h2>
              <p>{achievement.description}</p>
              <div className="earned-by">
                {unlocked ? (
                  earnedBy.map((world) => (
                    <button key={world.id} onClick={() => onOpen(world.id)}>
                      {world.name} ↗
                    </button>
                  ))
                ) : (
                  <span>A story yet to be told.</span>
                )}
              </div>
            </article>
          )
        })}
      </div>
      {worlds.length === 0 && (
        <div className="discovery-start">
          <p>Your first discovery begins with a world.</p>
          <button className="button button-primary" onClick={onCreate}>
            Create your world
            <Sparkles size={16} />
          </button>
        </div>
      )}
    </main>
  )
}

"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  MapPin,
  Phone,
  Star,
  ArrowRight,
  LogIn,
} from "lucide-react"

import { uk } from "@/lib/i18n/uk"
import { getPublicSalons, getPublicServices, getPublicStaff, PublicSalon, PublicService, PublicStaff } from "@/lib/public-api"

const STORAGE_KEY = "ap_selected_salon"
const motionCfg = { duration: 0.2 }

const reviewCards = [
  {
    name: "Марина К.",
    text: "Дуже делікатний сервіс та професійні майстри. Результат перевершив очікування.",
    rate: 5,
  },
  {
    name: "Анна Р.",
    text: "Зручний онлайн-запис і приємна атмосфера. Рекомендую салон у центрі.",
    rate: 5,
  },
  {
    name: "Юлія С.",
    text: "Косметолог підібрала ідеальний догляд. Обов'язково повернуся ще.",
    rate: 5,
  },
]

const brands = ["GUINOT", "WELLA", "L'OREAL", "DAVINES", "KEUNE"]

const salonPhotos = {
  hero: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1800&q=80",
  service1: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80",
  service2: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80",
  service3: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=800&q=80",
  master1: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80",
  master2: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80",
  master3: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
  before: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1000&q=80",
  after: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1000&q=80",
}

export default function LandingPage() {
  const [salons, setSalons] = useState<PublicSalon[]>([])
  const [selectedSalonId, setSelectedSalonId] = useState<number | null>(null)
  const [services, setServices] = useState<PublicService[]>([])
  const [staff, setStaff] = useState<PublicStaff[]>([])
  const [quickService, setQuickService] = useState<number | "">("")
  const [quickDate, setQuickDate] = useState("")
  const [beforeRatio, setBeforeRatio] = useState(50)

  useEffect(() => {
    getPublicSalons()
      .then((data) => {
        setSalons(data)
        if (!data.length) return

        const saved = Number(localStorage.getItem(STORAGE_KEY) || "")
        const fromCookie = Number(
          document.cookie
            .split("; ")
            .find((x) => x.startsWith("ap_salon="))
            ?.split("=")[1] || ""
        )
        const fallback = data[0].id
        const selected = data.find((item) => item.id === saved || item.id === fromCookie)?.id || fallback
        setSelectedSalonId(selected)
      })
      .catch(() => {
        setSalons([])
      })
  }, [])

  useEffect(() => {
    if (!selectedSalonId) return

    localStorage.setItem(STORAGE_KEY, String(selectedSalonId))
    document.cookie = `ap_salon=${selectedSalonId}; path=/; max-age=2592000`

    getPublicServices(selectedSalonId).then(setServices).catch(() => setServices([]))
    getPublicStaff(selectedSalonId).then(setStaff).catch(() => setStaff([]))
  }, [selectedSalonId])

  const selectedSalon = useMemo(
    () => salons.find((salon) => salon.id === selectedSalonId) || null,
    [salons, selectedSalonId]
  )

  return (
    <div className="prime-page">
      <div className="prime-background" />

      <header className="prime-header">
        <div className="prime-container prime-header-inner">
          <div className="prime-logo-wrap">
            <div className="prime-logo-circle">A</div>
            <div>
              <div className="prime-logo-title">{uk.brand.name}</div>
              <div className="prime-logo-sub">{uk.brand.tagline}</div>
            </div>
          </div>

          <nav className="prime-nav">
            <a href="#services">{uk.nav.services}</a>
            <a href="#masters">{uk.nav.masters}</a>
            <a href="#before-after">{uk.nav.offers}</a>
            <a href="#reviews">{uk.nav.blog}</a>
            <a href="#contacts">{uk.nav.contacts}</a>
          </nav>

          <div className="prime-header-actions">
            <div className="prime-salon-switcher">
              <span>Салон:</span>
              <select
                value={selectedSalonId ?? ""}
                onChange={(e) => setSelectedSalonId(Number(e.target.value))}
              >
                {salons.map((salon) => (
                  <option key={salon.id} value={salon.id}>
                    {salon.name.replace("Aesthetic Prime - ", "")}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} />
            </div>
            <Link href="/login" className="prime-cabinet-btn">
              <LogIn size={15} />
              <span>Кабінет</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="prime-main">
        <section className="prime-hero prime-container">
          <img src={salonPhotos.hero} alt="Aesthetic Prime" className="prime-hero-image" />
          <div className="prime-hero-overlay" />

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionCfg}
            className="prime-hero-content"
          >
            <h1>{uk.hero.title}</h1>
            <p>{uk.hero.subtitle}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...motionCfg, delay: 0.05 }}
            className="prime-booking-glass"
          >
            <select value={quickService} onChange={(e) => setQuickService(e.target.value ? Number(e.target.value) : "")}>
              <option value="">{uk.hero.pickService}</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>

            <select
              value={selectedSalonId ?? ""}
              onChange={(e) => setSelectedSalonId(Number(e.target.value))}
            >
              {salons.map((salon) => (
                <option key={salon.id} value={salon.id}>
                  {salon.name}
                </option>
              ))}
            </select>

            <input
              type="datetime-local"
              value={quickDate}
              onChange={(e) => setQuickDate(e.target.value)}
              aria-label={uk.hero.pickDate}
            />

            <Link
              href={`/zapys${
                selectedSalonId
                  ? `?salon=${selectedSalonId}${quickService ? `&service=${quickService}` : ""}`
                  : ""
              }`}
              className="prime-book-btn"
            >
              {uk.hero.cta}
              <ArrowRight size={16} />
            </Link>
          </motion.div>

          <div className="prime-booking-mobile-stepper">
            <div className="prime-mobile-step">
              <MapPin size={16} /> {selectedSalon?.name || uk.hero.pickSalon}
            </div>
            <div className="prime-mobile-step">
              <CalendarDays size={16} /> {quickDate ? quickDate.replace("T", " ") : uk.hero.pickDate}
            </div>
            <Link href={`/zapys${selectedSalonId ? `?salon=${selectedSalonId}` : ""}`} className="prime-mobile-hero-btn">
              {uk.nav.book}
            </Link>
          </div>
        </section>

        <section id="services" className="prime-section prime-container">
          <h2>{uk.sections.servicesTitle}</h2>
          <p>{uk.sections.servicesSubtitle}</p>
          <div className="prime-grid-3">
            {(services.length ? services.slice(0, 3) : [1, 2, 3]).map((item, idx) => {
              const service = typeof item === "number" ? null : item
              const image = idx === 0 ? salonPhotos.service1 : idx === 1 ? salonPhotos.service2 : salonPhotos.service3
              return (
                <motion.article
                  key={service?.id || idx}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={motionCfg}
                  className="prime-card"
                >
                  <img src={image} alt={service?.name || "Послуга"} />
                  <div className="prime-card-body">
                    <div className="prime-card-title">{service?.name || "Преміум догляд"}</div>
                    <div className="prime-card-sub">
                      від {Math.round(service?.price || 700)} грн | {service?.duration_minutes || 60} хв
                    </div>
                    <Link href={`/zapys${selectedSalonId ? `?salon=${selectedSalonId}` : ""}`} className="prime-chip-btn">
                      Детальніше
                    </Link>
                  </div>
                </motion.article>
              )
            })}
          </div>
        </section>

        <section id="masters" className="prime-section prime-container">
          <h2>{uk.sections.mastersTitle}</h2>
          <p>{uk.sections.mastersSubtitle}</p>
          <div className="prime-grid-3">
            {(staff.length ? staff.slice(0, 3) : [1, 2, 3]).map((item, idx) => {
              const person = typeof item === "number" ? null : item
              const image = idx === 0 ? salonPhotos.master1 : idx === 1 ? salonPhotos.master2 : salonPhotos.master3
              return (
                <motion.article
                  key={person?.id || idx}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={motionCfg}
                  className="prime-card"
                >
                  <img src={image} alt={person?.first_name || "Майстер"} />
                  <div className="prime-card-body">
                    <div className="prime-card-title">
                      {person ? `${person.first_name} ${person.last_name}` : "Експерт салону"}
                    </div>
                    <div className="prime-card-sub">Професійний майстер Aesthetic Prime</div>
                    <button className="prime-chip-btn">Дивитись профіль</button>
                  </div>
                </motion.article>
              )
            })}
          </div>
        </section>

        <section id="before-after" className="prime-section prime-container">
          <h2>{uk.sections.beforeAfterTitle}</h2>
          <p>{uk.sections.beforeAfterSubtitle}</p>

          <div className="prime-before-after">
            <div className="prime-ba-images">
              <img src={salonPhotos.before} alt="До" className="prime-ba-before" />
              <img
                src={salonPhotos.after}
                alt="Після"
                className="prime-ba-after"
                style={{ clipPath: `inset(0 0 0 ${beforeRatio}%)` }}
              />
              <div className="prime-ba-divider" style={{ left: `${beforeRatio}%` }} />
              <input
                type="range"
                min={0}
                max={100}
                value={beforeRatio}
                onChange={(e) => setBeforeRatio(Number(e.target.value))}
                className="prime-ba-slider"
              />
            </div>

            <div className="prime-ba-sidebar">
              <div className="prime-ba-avatars">
                {staff.slice(0, 3).map((item) => (
                  <div key={item.id} className="prime-avatar-dot">
                    {item.first_name.charAt(0)}
                  </div>
                ))}
              </div>
              <p>Індивідуальний підбір процедури для кожного типу шкіри.</p>
              <Link href={`/zapys${selectedSalonId ? `?salon=${selectedSalonId}` : ""}`} className="prime-book-btn prime-book-btn-small">
                Записатися
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        <section id="reviews" className="prime-section prime-container">
          <h2>{uk.sections.reviewsTitle}</h2>
          <p>{uk.sections.reviewsSubtitle}</p>
          <div className="prime-grid-3">
            {reviewCards.map((review) => (
              <article className="prime-review" key={review.name}>
                <div className="prime-review-stars">
                  {Array.from({ length: review.rate }).map((_, idx) => (
                    <Star key={idx} size={14} fill="currentColor" />
                  ))}
                </div>
                <p>{review.text}</p>
                <strong>{review.name}</strong>
              </article>
            ))}
          </div>

          <div className="prime-brands">
            {brands.map((brand) => (
              <span key={brand}>{brand}</span>
            ))}
          </div>
        </section>

        <section className="prime-section prime-container" id="contacts">
          <h2>{uk.sections.salonsTitle}</h2>
          <div className="prime-grid-2">
            {salons.map((salon) => (
              <article key={salon.id} className="prime-salon-card">
                <div>
                  <h3>{salon.name}</h3>
                  <p>
                    <MapPin size={15} /> {salon.address || "Київ"}
                  </p>
                </div>
                <div className="prime-salon-meta">
                  <span>
                    <Clock3 size={15} /> 09:00 - 21:00
                  </span>
                  <span>
                    <Phone size={15} /> +380 (86) 97 123 45
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="prime-footer" id="footer">
        <div className="prime-container prime-footer-inner">
          <div className="prime-logo-wrap">
            <div className="prime-logo-circle">A</div>
            <div className="prime-logo-title">Aesthetic Prime</div>
          </div>
          <div className="prime-footer-links">
            <a href="#services">Послуги</a>
            <a href="#masters">Майстри</a>
            <a href="#contacts">Контакти</a>
          </div>
          <div className="prime-footer-copy">www.xcna.in | +380 97 123 45 67</div>
        </div>
      </footer>

      <div className="prime-sticky-cta-mobile">
        <Link href={`/zapys${selectedSalonId ? `?salon=${selectedSalonId}` : ""}`}>{uk.nav.book}</Link>
      </div>
    </div>
  )
}

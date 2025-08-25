(function () {
document.documentElement.classList.add("js-enabled");

  // AOS (varsayılan güvenli init)
  try {
    if (window.AOS && typeof AOS.init === "function") {
      AOS.init({ duration: 800, easing: "ease-in-out", once: true });
    }
  } catch (e) {
    console.warn("AOS init skipped:", e);
  }

  // Reveal .will-animate
  const items = Array.from(document.querySelectorAll(".will-animate"));
  items.forEach((el, idx) => {
    const delay = parseFloat(el.style.getPropertyValue("--delay")) || (idx * 0.04);
    setTimeout(() => el.classList.add("in"), delay * 1000);
  });

  // Mobile menu
// Mobile Menu System
const btn = document.getElementById("menu-btn");
const mobileMenu = document.getElementById("mobile-menu");
const menuWrapper = document.getElementById("menu-wrapper");


if (btn && mobileMenu && menuWrapper) {
  btn.addEventListener("click", () => {
    const isClosed = menuWrapper.classList.contains("translate-y-full");

    if (isClosed) {
      // Menü açılıyor
      menuWrapper.classList.remove("translate-y-full");
      menuWrapper.classList.add("translate-y-0");

      // İkon animasyonu + text değişimi
      headphoneIcon.classList.add("rotate-180", "text-white");
      headphoneIcon.classList.remove("text-gold");
      menuText.textContent = "Close";

      // Mobil menü etkileşime açık
      mobileMenu.classList.remove("pointer-events-none");
      mobileMenu.classList.add("pointer-events-auto");
    } else {
      // Menü kapanıyor
      menuWrapper.classList.add("translate-y-full");
      menuWrapper.classList.remove("translate-y-0");

      // İkon ve text sıfırlanıyor
      headphoneIcon.classList.remove("rotate-180", "text-white");
      headphoneIcon.classList.add("text-gold");
      menuText.textContent = "Menu";

      // Mobil menü etkileşime kapalı
      setTimeout(() => {
        mobileMenu.classList.add("pointer-events-none");
        mobileMenu.classList.remove("pointer-events-auto");
      }, 500); // transition süresi kadar bekle
    }
  });

  // Linklere tıklayınca menüyü kapat
  mobileMenu.querySelectorAll("[data-close]").forEach(link => {
    link.addEventListener("click", () => {
      menuWrapper.classList.add("translate-y-full");
      menuWrapper.classList.remove("translate-y-0");
      headphoneIcon.classList.remove("rotate-180", "text-white");
      headphoneIcon.classList.add("text-gold");
      menuText.textContent = "Menu";
      setTimeout(() => {
        mobileMenu.classList.add("pointer-events-none");
        mobileMenu.classList.remove("pointer-events-auto");
      }, 500);
    });
  });
}


  // Smooth anchors
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // ---- SPLIDE GALLERY INIT (ÇALIŞAN) ----
  function initGalleries() {
    if (typeof Splide === "undefined") {
      console.warn("Splide has not loaded yet, trying again...");
      return setTimeout(initGalleries, 50);
    }

    document.querySelectorAll(".gallery").forEach((wrap, sIdx) => {
      const mainId = `#main-${sIdx}`;
      const thumbsId = `#thumbs-${sIdx}`;

     // Her galeri için ayrı instance
    const mainSplide = new Splide(mainId, {
    type: 'loop',
    pagination: false,
    arrows: true,
    speed: 800,

    // ÖNEMLİ: slide yüksekliği (16:9 = 0.5625)
    heightRatio: 0.5625,

    // Görselleri arkaplan olarak uygula (img’yi Splide gizler)
    cover: true,

    // İsteğe göre breakpoints
    breakpoints: {
        640: { heightRatio: 0.75 },   // mobilde biraz daha dik
        1024: { heightRatio: 0.5625 } // tablet/laptop 16:9
    }
    });

      const thumbSplide = new Splide(thumbsId, {
        type: 'slide',
        rewind: true,
        pagination: false,
        isNavigation: true,
        arrows: false,
        gap: '10px',
        fixedWidth: 100,
        fixedHeight: 60,
        cover: true,
        breakpoints: {
          640: {
            fixedWidth: 60,
            fixedHeight: 40,
            gap: '5px',
          },
          768: {
            fixedWidth: 80,
            fixedHeight: 50,
          },
        },
      });

      mainSplide.sync(thumbSplide);
      mainSplide.mount();
      thumbSplide.mount();
    });
  }

  // DOM hazır olduktan sonra başlat
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGalleries);
  } else {
    initGalleries();
  }
    
    // ---- Navbar renk değişimi (scroll + route kuralı) ----
    const header = document.getElementById("header");
    const logo = document.getElementById("logo");
    const txtLinks = document.querySelectorAll(".txt");
    const menuBtn = document.getElementById("menu-btn");
    const headphoneIcon = document.getElementById("headphone-icon");
    const menuText = document.getElementById("menu-text");

    // Hangi rotalarda her zaman solid olacağını tanımla:
    const FORCE_SOLID_ROUTES = [/^\/gallery\/?$/, /^\/en\/gallery\/?$/];
    const forceSolid = FORCE_SOLID_ROUTES.some(r => r.test(window.location.pathname));

    function setNavbarState(past) {
    // arka plan / blur / border / shadow
    header.classList.toggle("bg-beige", past);
    header.classList.toggle("bg-transparent", !past);
    header.classList.toggle("shadow-md", past);
    header.classList.add("backdrop-blur-sm"); // blur hep açık kalsın

    // logo & link renkleri
    logo.classList.toggle("text-black", past);
    logo.classList.toggle("text-white", !past);

    txtLinks.forEach((el) => {
        el.classList.toggle("text-black", past);
        el.classList.toggle("text-white", !past);
    });

    // mobil buton + ikon + yazı
    if (menuBtn) {
        menuBtn.classList.toggle("text-black", past);
        menuBtn.classList.toggle("text-gold", !past);
    }
    if (headphoneIcon) {
        headphoneIcon.classList.toggle("text-black", past);
        headphoneIcon.classList.toggle("text-gold", !past);
    }
    if (menuText) {
        menuText.classList.toggle("text-black", past);
        menuText.classList.toggle("text-white", !past);
    }
    }

    function updateNavbarColors() {
    const past = window.scrollY > 50;
    setNavbarState(past);
    }

    // Route galeri ise: her zaman solid, scroll listener yok
    if (forceSolid) {
    setNavbarState(true);
    } else {
    // Normal sayfalarda: tepedeyken beyaz yazı, aşağıda siyah
    updateNavbarColors();
    window.addEventListener("scroll", updateNavbarColors, { passive: true });
    }

})();
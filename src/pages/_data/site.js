export default {
  url: process.env.SITE_URL ?? "http://localhost",
  navitems: [
    { title: "Authors", path: "/authors", description: "Explore the authors whose works are featured on this site.", icon: "people" },
    { title: "Contributors", path: "/contributors", description: "Meet the people who have contributed to this site.", icon: "people" },
    { title: "Library", path: "/library", description: "Browse the full collection of freely given books.", icon: "book" },
    { title: "About", path: "/about", description: "Learn more about this project and its mission.", icon: "info-circle" },
    { title: "Contact", path: "/contact", description: "Get in touch with questions or suggestions.", icon: "envelope" },
  ],
};

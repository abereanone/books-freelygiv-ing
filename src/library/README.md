# Freely Given Books Data

## How to Contribute

### Licensing Requirements

All submitted books must be freely distributable. Copyrighted material is not accepted. Submissions should be one of the following:

- **CC0** (preferred) — no rights reserved
- **Public domain** — works old enough to have no remaining copyright
- **Permissive Creative Commons** — CC-BY or CC-BY-SA; licenses with NC (NonCommercial) or ND (NoDerivatives) restrictions are generally not accepted

When in doubt, CC0 is encouraged. The goal is that every book on this site can be read, shared, and built upon without restriction.

---

Books are organized under `data/src/` by author slug. Each author has their own directory containing an `author.yaml` and one subdirectory per book.

```
data/src/
└── firstname-lastname/
    ├── author.yaml
    ├── firstname-lastname.jpg
    └── book-title-slug/
        ├── book.yaml
        └── content/
            ├── cover.jpg
            └── book-title-slug.pdf
```

Contributors (those who typeset or prepare books rather than write them) follow the same pattern but use `contributor.yaml` instead of `author.yaml`.

---

### author.yaml

```yaml
- firstName: ""
  lastName: ""
  slug: ""                                         # kebab-case: firstname-lastname
  photo: "/static/images/authors/SLUG/SLUG.jpg"
  description: >
    A brief biography of the author.
  donateUrl: ""                                    # optional link to support the author
```

---

### contributor.yaml

```yaml
- firstName: ""
  lastName: ""
  slug: ""                                         # kebab-case: firstname-lastname
  photo: "/static/images/contributors/SLUG/SLUG.jpg"
  description: >
    A brief bio of the contributor and their role.
  donateUrl: ""
```

---

### book.yaml

```yaml
- title: ""
  sortTitle: ""                                    # usually the same as title
  authors:
    - slug: ""                                     # must match the author's slug
      firstName: ""
      lastName: ""
  year:                                            # publication year, e.g. 1678
  tags:
    - classic                                      # classic | modern
  contributors:
    - contributor-slug                             # slug of anyone who typeset/prepared this edition
  description: >
    A description of the book shown on the site.
  license: CC0                                     # CC0 | CC-BY | etc.
  path: /static/books/AUTHOR-SLUG/BOOK-SLUG
  cover: cover.jpg
  mediaTypes:
    - type: eBook
      label: eBook
      sources:
        - name: Download
          url: "/static/books/AUTHOR-SLUG/BOOK-SLUG/BOOK-SLUG.epub"
    - type: pdfBook
      label: PDF
      sources:
        - name: Download
          url: "/static/books/AUTHOR-SLUG/BOOK-SLUG/BOOK-SLUG.pdf"
    - type: printBook
      label: Book
      sources:
        - name: Amazon
          url: ""
```

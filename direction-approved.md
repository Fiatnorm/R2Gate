# Approved design direction

## User selection

> 采用A的方案，需要进行调整，Status和Files都需要各自占用一个页面，不用放入同一个界面。且需要增加一个可以跳转会项目地址https://github.com/Fiatnorm/R2Gate的组件按钮在左侧。项目样式风格需要全局统一。不需要有多余的文字介绍，简洁美观。图二所示的图标更改为图一所示图标。

> A 的整体布局 + C 的文件列表

> A 的整体布局 + C 的文件列表，列表做出C的样式。

## Approved implementation

- Use Direction A's Material Design 3 navigation rail and global dark visual system.
- Use Direction C's compact file list on the Files page.
- Keep Status (`/`) and Files (`/_files`) as separate pages.
- Add a GitHub navigation component linking to `https://github.com/Fiatnorm/R2Gate`.
- Replace the R2 letter tile with the supplied orange database icon, implemented as a lightweight inline SVG.
- Keep copy minimal and preserve all existing authorization, pagination, encoding, and no-leak behavior.

## Reference artifacts

- `design-demos/direction-a.html`
- `design-demos/direction-a.png`
- `design-demos/direction-c.html`
- `design-demos/direction-c.png`
- User-supplied `R2Gate.png`

## Verified production previews

- `design-demos/final-status.png`
- `design-demos/final-files-public.png`
- `design-demos/final-files-all.png`
- `design-demos/final-status-mobile.png`
- `design-demos/final-files-all-mobile-full.png`

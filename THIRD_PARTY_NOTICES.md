# 第三方素材与许可

Folio 原创代码：Copyright (c) 2026 RyanLin，MIT License。根目录 LICENSE 不重新许可第三方内容。

- **Tauri NSIS 模板**：`src-tauri/installer/upstream.nsi` 来源于 Tauri CLI v2.12.3。保留 Tauri 的 MIT / Apache-2.0 许可，见 `licenses/TAURI-MIT.txt`、`licenses/TAURI-APACHE-2.0.txt` 与安装器 README。
- **shadcn/ui**：`src/components/ui/` 基于 shadcn/ui，MIT；许可见 `licenses/SHADCN-MIT.txt`。
- **flag-icons**：国旗与对应图形，MIT，见 `licenses/FLAG-ICONS-MIT.txt`。
- **地区坐标**：Google DSPL canonical countries，BSD 许可全文位于 `public/map-data-license.txt`。
- **地图海岸线**：Natural Earth 公有领域数据，来源见 `docs/MAP_DATA.md`。
- **卡面图鉴**：`public/cards/` 与 `src/catalog.json` 收录发卡机构、运营商、CardFi 等公开产品参考图。各项记录保留 `source` 等来源字段。卡面、商标及其中图形归原权利人，**不属于本项目 MIT 授权的原创素材**。展示用于产品识别，不表示合作、背书、可申请状态或获得商用授权。使用和再分发这些素材时请自行确认权利；权利人可通过仓库 Issue 联系处理。
- **地址预设图**：用于不同国家建筑风格的街区航拍示意，不是用户地址、实时卫星照片或定位结果。
- **其他依赖**：React、Vite、Lucide、Radix、Framer Motion、Tauri 及其他 npm/Cargo 依赖保留各自许可，版本由 lockfile 固定。
- **WebDAV 依赖**：fast-xml-parser、@nodable/entities 与 reqwest 保留各自许可；@nodable/entities 的 npm 包未附带许可正文，补充的上游 MIT 许可见 `licenses/NODABLE-ENTITIES-MIT.txt`（来源：<https://github.com/nodable/val-parsers/blob/main/LICENSE>）。

发行安装包随附完整第三方许可汇总 `THIRD_PARTY_LICENSES.txt`。Folio 的 MIT 许可不授予对第三方商标的权利。

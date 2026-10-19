#include <windows.h>
#include <commctrl.h>
#include <gdiplus.h>

// Presentation only: installation decisions and file operations stay in NSIS.
class BufferedButton {
 public:
  HDC dc;
  explicit BufferedButton(const DRAWITEMSTRUCT& item) : target(item.hDC), bounds(item.rcItem) {
    dc = CreateCompatibleDC(target);
    bitmap = CreateCompatibleBitmap(target, bounds.right, bounds.bottom);
    previous = SelectObject(dc, bitmap);
  }
  ~BufferedButton() {
    BitBlt(target, 0, 0, bounds.right, bounds.bottom, dc, 0, 0, SRCCOPY);
    SelectObject(dc, previous);
    DeleteObject(bitmap);
    DeleteDC(dc);
  }
 private:
  HDC target;
  RECT bounds;
  HBITMAP bitmap;
  HGDIOBJ previous;
};

static LRESULT CALLBACK ButtonProc(HWND window, UINT message, WPARAM wp, LPARAM lp,
                                   UINT_PTR id, DWORD_PTR primary) {
  if (message == WM_MOUSEMOVE) {
    if (!GetPropW(window, L"FolioHover")) {
      TRACKMOUSEEVENT track{sizeof(track), TME_LEAVE, window, 0};
      TrackMouseEvent(&track);
      SetPropW(window, L"FolioHover", reinterpret_cast<HANDLE>(1));
      InvalidateRect(window, nullptr, FALSE);
    }
  } else if (message == WM_MOUSELEAVE) {
    RemovePropW(window, L"FolioHover");
    InvalidateRect(window, nullptr, FALSE);
  } else if (message == WM_ERASEBKGND) {
    return 1;
  } else if (message == BM_SETSTYLE) {
    // The dialog manager changes the default button on focus. Keep our renderer.
    wp = (wp & ~BS_TYPEMASK) | BS_OWNERDRAW;
  } else if (message == WM_NCDESTROY) {
    RemovePropW(window, L"FolioHover");
    RemovePropW(window, L"FolioStyle");
    RemoveWindowSubclass(window, ButtonProc, id);
  }
  return DefSubclassProc(window, message, wp, lp);
}

static LRESULT CALLBACK ParentProc(HWND window, UINT message, WPARAM wp, LPARAM lp,
                                   UINT_PTR id, DWORD_PTR) {
  if (message == WM_DRAWITEM) {
    auto item = reinterpret_cast<DRAWITEMSTRUCT*>(lp);
    auto style = GetPropW(item->hwndItem, L"FolioStyle");
    if (item->CtlType == ODT_BUTTON && style) {
      const bool primary = style == reinterpret_cast<HANDLE>(2);
      const bool hovered = GetPropW(item->hwndItem, L"FolioHover") != nullptr;
      const bool pressed = (item->itemState & ODS_SELECTED) != 0;
      const bool disabled = (item->itemState & ODS_DISABLED) != 0;
      BufferedButton buffer(*item);
      Gdiplus::Graphics graphics(buffer.dc);
      graphics.SetSmoothingMode(Gdiplus::SmoothingModeAntiAlias);
      graphics.Clear(Gdiplus::Color(255, 255, 255));
      const float w = static_cast<float>(item->rcItem.right), h = static_cast<float>(item->rcItem.bottom);
      const float r = min(20.f, h * .4f);
      Gdiplus::GraphicsPath path;
      path.AddArc(1.f, 1.f, r, r, 180.f, 90.f); path.AddArc(w-r-1, 1.f, r, r, 270.f, 90.f);
      path.AddArc(w-r-1, h-r-1, r, r, 0.f, 90.f); path.AddArc(1.f, h-r-1, r, r, 90.f, 90.f);
      path.CloseFigure();
      BYTE shade = primary ? (pressed ? 15 : hovered ? 61 : 36) : (pressed ? 232 : hovered ? 244 : 255);
      if (disabled) shade = 230;
      Gdiplus::SolidBrush brush(Gdiplus::Color(shade, shade, shade));
      graphics.FillPath(&brush, &path);
      wchar_t text[128]{}; GetWindowTextW(item->hwndItem, text, 128);
      if (lstrcmpW(text, L"×") == 0 || lstrcmpW(text, L"—") == 0) {
        Gdiplus::Pen pen(Gdiplus::Color(100, 100, 110), max(1.2f, h / 28.f));
        const float cx=w/2, cy=h/2, half=h*.14f;
        if (lstrcmpW(text, L"×") == 0) {
          graphics.DrawLine(&pen, cx-half, cy-half, cx+half, cy+half);
          graphics.DrawLine(&pen, cx+half, cy-half, cx-half, cy+half);
        } else graphics.DrawLine(&pen, cx-half, cy, cx+half, cy);
        return TRUE;
      }
      graphics.Flush(Gdiplus::FlushIntentionSync);
      auto font = reinterpret_cast<HFONT>(SendMessageW(item->hwndItem, WM_GETFONT, 0, 0));
      auto previous = SelectObject(buffer.dc, font);
      SetBkMode(buffer.dc, TRANSPARENT);
      SetTextColor(buffer.dc, disabled ? RGB(150,150,150) : primary ? RGB(255,255,255) : RGB(95,95,105));
      DrawTextW(buffer.dc, text, -1, &item->rcItem, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
      SelectObject(buffer.dc, previous);
      return TRUE;
    }
  } else if (message == WM_NCDESTROY) {
    RemoveWindowSubclass(window, ParentProc, id);
  }
  return DefSubclassProc(window, message, wp, lp);
}

extern "C" void __stdcall StyleButton(HWND button, int primary) {
  static ULONG_PTR token = 0;
  if (!token) { Gdiplus::GdiplusStartupInput input; Gdiplus::GdiplusStartup(&token, &input, nullptr); }
  SetPropW(button, L"FolioStyle", reinterpret_cast<HANDLE>(primary ? 2 : 1));
  auto style = GetWindowLongPtrW(button, GWL_STYLE);
  SetWindowLongPtrW(button, GWL_STYLE, (style & ~BS_TYPEMASK) | BS_OWNERDRAW);
  SetWindowSubclass(GetParent(button), ParentProc, 1, 0);
  SetWindowSubclass(button, ButtonProc, 1, primary);
  InvalidateRect(button, nullptr, TRUE);
}

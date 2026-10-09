'use client';

// Zoom/pan and Radix dialog integration adapted from Stackzero Commerce UI (MIT).
// Copyright and license: licenses/stackzero-commerce-ui.txt.
import { useState } from 'react';
import Image from 'next/image';
import * as Dialog from '@radix-ui/react-dialog';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from 'lucide-react';
import type { ProductImage } from '@/lib/resource-product-media';
import s from './product.module.css';

export default function ImageViewer({ images, initialIndex = 0, open, onOpenChange, returnFocus }: {
  images: ProductImage[]; initialIndex?: number; open: boolean; onOpenChange: (value: boolean) => void; returnFocus: HTMLElement | null;
}) {
  const [index, setIndex] = useState(initialIndex);
  const image = images[index];
  function move(direction: number) { setIndex(current => (current + direction + images.length) % images.length); }
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className={s.viewerOverlay} />
      <Dialog.Content className={s.viewerDialog} onCloseAutoFocus={event => { event.preventDefault(); returnFocus?.focus(); }}
        onKeyDown={event => {
          if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
          if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
        }}>
        <header className={s.viewerHeader}>
          <div><Dialog.Title>{image.alt}</Dialog.Title><Dialog.Description>滚轮或双指缩放，拖动查看细节</Dialog.Description></div>
          <Dialog.Close className={s.viewerIcon} aria-label="关闭图片预览"><X size={22} /></Dialog.Close>
        </header>
        <TransformWrapper key={image.src} minScale={1} maxScale={5} centerOnInit wheel={{ step: .15 }} doubleClick={{ step: 1 }}>
          {({ zoomIn, zoomOut, resetTransform }) => <>
            <div className={s.viewerCanvas}>
              <TransformComponent wrapperClass={s.zoomWrapper} contentClass={s.zoomContent}>
                <Image src={image.src} alt={image.alt} width={image.width} height={image.height} draggable={false} />
              </TransformComponent>
            </div>
            <div className={s.viewerToolbar}>
              <button type="button" onClick={() => move(-1)} aria-label="预览上一张"><ChevronLeft size={20} /></button>
              <span aria-live="polite">{index + 1} / {images.length}</span>
              <button type="button" onClick={() => move(1)} aria-label="预览下一张"><ChevronRight size={20} /></button>
              <i aria-hidden="true" />
              <button type="button" onClick={() => zoomOut()} aria-label="缩小图片"><Minus size={20} /></button>
              <button type="button" onClick={() => resetTransform()} aria-label="重置图片大小"><RotateCcw size={18} /></button>
              <button type="button" onClick={() => zoomIn()} aria-label="放大图片"><Plus size={20} /></button>
            </div>
          </>}
        </TransformWrapper>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

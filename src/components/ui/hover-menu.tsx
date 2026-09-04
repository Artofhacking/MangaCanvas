"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { cn } from "@/lib/utils"

const useHoverOpenState = (closeDelay = 180) => {
  const [open, setOpen] = React.useState(false)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearCloseTimer = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const handleMouseEnter = React.useCallback(() => {
    clearCloseTimer()
    setOpen(true)
  }, [clearCloseTimer])

  const handleMouseLeave = React.useCallback(() => {
    clearCloseTimer()
    timeoutRef.current = setTimeout(() => {
      setOpen(false)
      timeoutRef.current = null
    }, closeDelay)
  }, [clearCloseTimer, closeDelay])

  React.useEffect(() => clearCloseTimer, [clearCloseTimer])

  return {
    open,
    setOpen,
    handleMouseEnter,
    handleMouseLeave,
  }
}

const HoverMenuTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.Trigger
    ref={ref}
    className={cn("outline-none", className)}
    {...props}
  >
    {children}
  </DropdownMenuPrimitive.Trigger>
))
HoverMenuTrigger.displayName = DropdownMenuPrimitive.Trigger.displayName

const HoverMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-xl border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-lowest))] p-1.5 text-[hsl(var(--on-surface))] shadow-xl shadow-black/10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
HoverMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const HoverMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none transition-colors focus:bg-[hsl(var(--surface-container-high))] focus:text-[hsl(var(--on-surface))] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
HoverMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const HoverMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-xs font-medium text-[hsl(var(--secondary))]",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
HoverMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const HoverMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-[hsl(var(--outline-variant))]/30", className)}
    {...props}
  />
))
HoverMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

// 支持 hover 的子菜单
interface HoverSubMenuProps {
  children: React.ReactNode
  trigger: React.ReactNode
  className?: string
}

const HoverSubMenu = ({ children, trigger, className }: HoverSubMenuProps) => {
  const { open, setOpen, handleMouseEnter, handleMouseLeave } = useHoverOpenState(220)

  return (
    <DropdownMenuPrimitive.Sub open={open} onOpenChange={setOpen}>
      <DropdownMenuPrimitive.SubTrigger
        className={cn(
          "flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none transition-colors focus:bg-[hsl(var(--surface-container-high))] data-[state=open]:bg-[hsl(var(--surface-container-high))]",
          className
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {trigger}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-auto h-4 w-4 text-[hsl(var(--secondary))]"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </DropdownMenuPrimitive.SubTrigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.SubContent
          className="z-50 min-w-[8rem] overflow-hidden rounded-xl border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-lowest))] p-1.5 text-[hsl(var(--on-surface))] shadow-xl shadow-black/10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          sideOffset={8}
          alignOffset={-4}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {children}
        </DropdownMenuPrimitive.SubContent>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Sub>
  )
}

// 主菜单容器，处理 hover 打开逻辑
interface HoverMenuContainerProps {
  children: React.ReactNode
  className?: string
}

const HoverMenuContainer = ({ children, className }: HoverMenuContainerProps) => {
  const { open, setOpen, handleMouseEnter, handleMouseLeave } = useHoverOpenState(220)

  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen} modal={false}>
      <div
        className={cn("relative inline-block", className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
    </DropdownMenuPrimitive.Root>
  )
}

// 简化的 hover 菜单组件
interface SimpleHoverMenuProps {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: "start" | "center" | "end"
  className?: string
  contentClassName?: string
}

const SimpleHoverMenu = ({
  trigger,
  children,
  align = "end",
  className,
  contentClassName,
}: SimpleHoverMenuProps) => {
  const { open, setOpen, handleMouseEnter, handleMouseLeave } = useHoverOpenState(220)

  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen} modal={false}>
      <div
        className={cn("relative inline-block", className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <DropdownMenuPrimitive.Trigger asChild>
          <button className="outline-none">{trigger}</button>
        </DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align={align}
            sideOffset={0}
            className={cn(
              "z-50 min-w-[8rem] overflow-hidden rounded-xl border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-lowest))] p-1.5 text-[hsl(var(--on-surface))] shadow-xl shadow-black/10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              contentClassName,
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {children}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </div>
    </DropdownMenuPrimitive.Root>
  )
}

export {
  SimpleHoverMenu,
  HoverMenuContainer,
  HoverMenuTrigger,
  HoverMenuContent,
  HoverMenuItem,
  HoverMenuLabel,
  HoverMenuSeparator,
  HoverSubMenu,
}

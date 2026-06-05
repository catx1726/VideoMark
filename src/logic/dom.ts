/**
 * # DOM 工具类 (DOM Utility Classes)
 *
 * 本模块采用类封装模式组织 DOM 操作逻辑，提供 Shadow DOM 穿透、
 * 高亮物理操作及 URL 规范化等功能。
 * 核心设计原则是 **Shadow DOM 穿透能力**。
 */

/**
 * [DOMScanner] 负责 DOM 树的递归遍历与查询
 * [DOMScanner] 负责 DOM 树的递归遍历与查询
 */
export class DOMScanner {
  /**
   * 递归穿透 Shadow DOM，查找第一个匹配选择器的元素。
   */
  static querySelectorDeep(selector: string, root: Document | ShadowRoot = document): Element | null {
    const found = root.querySelector(selector)
    if (found)
      return found

    const allElements = root.querySelectorAll('*')
    for (const element of Array.from(allElements)) {
      if (element.shadowRoot) {
        const foundInShadow = DOMScanner.querySelectorDeep(selector, element.shadowRoot)
        if (foundInShadow)
          return foundInShadow
      }
    }
    return null
  }

  /**
   * 递归穿透 Shadow DOM，查找所有匹配选择器的元素。
   */
  static querySelectorAllDeep(selector: string, root: Document | ShadowRoot = document): Element[] {
    let results: Element[] = []
    root.querySelectorAll(selector).forEach(el => results.push(el))
    const allElements = root.querySelectorAll('*')
    for (const element of Array.from(allElements)) {
      if (element.shadowRoot)
        results = results.concat(DOMScanner.querySelectorAllDeep(selector, element.shadowRoot))
    }
    return results
  }

  /**
   * 获取指定节点下的所有文本节点（包含 Shadow DOM）
   */
  static getAllTextNodes(root: Node): Text[] {
    const nodes: Text[] = []
    const stack: Node[] = [root]

    while (stack.length > 0) {
      const node = stack.pop()!
      if (node.nodeType === Node.TEXT_NODE) {
        nodes.push(node as Text)
      }
      else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = (node as Element).tagName
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(tagName))
          continue

        if ((node as HTMLElement).shadowRoot) {
          const shadowNodes = (node as HTMLElement).shadowRoot!.childNodes
          for (let i = shadowNodes.length - 1; i >= 0; i--) {
            stack.push(shadowNodes[i])
          }
        }
        const childNodes = node.childNodes
        for (let i = childNodes.length - 1; i >= 0; i--) {
          stack.push(childNodes[i])
        }
      }
      else {
        const childNodes = node.childNodes
        for (let i = childNodes.length - 1; i >= 0; i--) {
          stack.push(childNodes[i])
        }
      }
    }
    return nodes
  }
}

/**
 * [DOMSelector] 负责元素身份识别与定位
 */
export class DOMSelector {
  /**
   * 为给定元素生成可复现的 CSS 选择器。
   */
  static getElementSelector(el: Element): string {
    if (!el || !(el instanceof Element))
      return ''
    if (el.id) {
      const escapedId = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(el.id) : el.id
      return `#${escapedId}`
    }
    const path: string[] = []
    let current: Element | null = el
    while (current) {
      const selector = current.tagName.toLowerCase()
      if (selector === 'body') {
        path.unshift(selector)
        break
      }
      const parentNode: HTMLElement | null = current.parentElement
      if (!parentNode) {
        path.unshift(selector)
        break
      }
      const siblings = Array.from(parentNode.children).filter((child: any) => (child as Element).tagName === current!.tagName)
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        path.unshift(`${selector}:nth-of-type(${index})`)
      }
      else {
        path.unshift(selector)
      }
      current = parentNode
    }
    return path.join(' > ')
  }

  /**
   * 寻找一组节点的最小公共祖先 (LCA)
   */
  static findCommonAncestor(nodes: Node[]): HTMLElement {
    if (nodes.length === 0)
      return document.body
    if (nodes.length === 1)
      return (nodes[0].nodeType === Node.ELEMENT_NODE ? nodes[0] : nodes[0].parentElement) as HTMLElement

    const contain = (parent: Node, child: Node) => {
      let curr: Node | null = child
      while (curr) {
        if (curr === parent)
          return true
        curr = curr.parentNode
      }
      return false
    }

    let lca = (nodes[0].nodeType === Node.ELEMENT_NODE ? nodes[0] : nodes[0].parentElement) as HTMLElement
    for (let i = 1; i < nodes.length; i++) {
      while (lca && !contain(lca, nodes[i])) {
        lca = lca.parentElement as HTMLElement
      }
    }
    return lca || (document.body as HTMLElement)
  }

  /**
   * 从元素中提取标记 ID
   */
  static getMarkIdFromElement(element: HTMLElement): string | null {
    const highlightClass = Array.from(element.classList).find(c => c.startsWith('webext-highlight-'))
    return highlightClass ? highlightClass.replace('webext-highlight-', '') : null
  }
}

/**
 * 获取页面最高 z-index
 */
export function getMaxZIndex(): number {
  let maxZIndex = 0
  const elements = document.querySelectorAll('body > *')
  elements.forEach((el) => {
    const style = window.getComputedStyle(el)
    if (style.zIndex !== 'auto' && style.position !== 'static') {
      const zIndex = Number.parseInt(style.zIndex, 10)
      if (!Number.isNaN(zIndex))
        maxZIndex = Math.max(maxZIndex, zIndex)
    }
  })
  return Math.max(maxZIndex, 1000)
}

/**
 * [URLNormalizer] 负责 URL 规范化 (OCP 合规)
 */
export class URLNormalizer {
  private static readonly DEFAULT_TRACKING_PARAMS = [
    'vd_source',
    'spm_id_from',
    'from_source',
    'from',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
  ]

  /**
   * 获取当前页面的规范化 URL。
   * 支持通过 customParams 扩展排除列表。
   */
  static getCanonicalUrl(customParams: string[] = []): string {
    const url = new URL(window.location.href)
    url.hash = ''

    const paramsToRemove = [...URLNormalizer.DEFAULT_TRACKING_PARAMS, ...customParams]
    paramsToRemove.forEach(param => url.searchParams.delete(param))

    let canonical = url.origin + url.pathname
    if (canonical.length > 1 && canonical.endsWith('/'))
      canonical = canonical.slice(0, -1)

    return canonical + url.search
  }
}

/**
 * [TextAnalyzer] 负责文本算法 (Dice's Coefficient)
 */
export class TextAnalyzer {
  /**
   * 极度清洗文本，移除所有不可见字符、控制字符及零宽字符
   */
  static cleanText(str: string): string {
    return str
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // 移除零宽字符
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // 移除控制字符
      .replace(/\s+/g, '') // 移除所有空白
      .toLowerCase()
  }

  /**
   * 计算两个字符串的相似度 (0-100)
   */
  static calculateSimilarity(str1: string, str2: string): number {
    const s1 = TextAnalyzer.cleanText(str1)
    const s2 = TextAnalyzer.cleanText(str2)

    if (s1 === s2)
      return 100
    if (!s1 || !s2)
      return 0

    if (s1.length < 2 || s2.length < 2) {
      const longer = s1.length > s2.length ? s1 : s2
      const shorter = s1.length > s2.length ? s2 : s1
      let matches = 0
      for (const char of shorter) {
        if (longer.includes(char))
          matches++
      }
      return Math.round((matches / longer.length) * 100)
    }

    const bigrams1 = new Set<string>()
    for (let i = 0; i < s1.length - 1; i++)
      bigrams1.add(s1.substring(i, i + 2))

    const bigrams2 = new Set<string>()
    for (let i = 0; i < s2.length - 1; i++)
      bigrams2.add(s2.substring(i, i + 2))

    let intersection = 0
    for (const bigram of bigrams1) {
      if (bigrams2.has(bigram))
        intersection++
    }
    return Math.round((2 * intersection) / (bigrams1.size + bigrams2.size) * 100)
  }
}

// --- 向下兼容导出 ---
/** @deprecated Use TextAnalyzer.calculateSimilarity */
export const calculateSimilarity = TextAnalyzer.calculateSimilarity
/** @deprecated Use DOMScanner.querySelectorDeep */
export const querySelectorDeep = DOMScanner.querySelectorDeep
/** @deprecated Use DOMScanner.querySelectorAllDeep */
export const querySelectorAllDeep = DOMScanner.querySelectorAllDeep
/** @deprecated Use DOMScanner.getAllTextNodes */
export const getAllTextNodes = DOMScanner.getAllTextNodes
/** @deprecated Use DOMSelector.getElementSelector */
export const getElementSelector = DOMSelector.getElementSelector
/** @deprecated Use DOMSelector.findCommonAncestor */
export const findCommonAncestor = DOMSelector.findCommonAncestor
/** @deprecated Use DOMSelector.getMarkIdFromElement */
export const getMarkIdFromElement = DOMSelector.getMarkIdFromElement
/** @deprecated Use URLNormalizer.getCanonicalUrl */
export const getCanonicalUrlForMark = URLNormalizer.getCanonicalUrl

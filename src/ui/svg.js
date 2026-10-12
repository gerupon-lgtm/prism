export function svg(tag,attrs={},text='') {
  const item=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [name,value] of Object.entries(attrs))item.setAttribute(name,value);
  if(text)item.textContent=text;
  return item;
}

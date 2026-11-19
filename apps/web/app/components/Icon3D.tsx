import type { Icon3DName, Icon3DSize } from "@/lib/icons3d";

/**
 * 3D 아이콘 하나 — '무엇에 관한 것인지'를 이름보다 먼저 보여 준다. 역할과 넣지 않는 자리는 lib/icons3d.ts.
 *
 * 뜻은 옆 글자가 말한다 — alt="" 로 두고 읽지 않는다(Perky 와 같은 규칙). 그림만 있고 글자가 없는 자리에는 쓰지 않는다.
 *
 * 정적 export 라 이미지 최적화가 없다(next.config.ts). 256px 한 장을 64px 이하로 줄여 그리므로 3배 화면에서도
 * 선명하다. width · height 를 적어 그림이 늦게 와도 줄이 밀리지 않는다.
 */
export function Icon3D({
  name,
  size,
  className = "",
}: {
  name: Icon3DName;
  size: Icon3DSize;
  className?: string;
}) {
  return (
    <img
      src={`/icons3d/${name}.webp`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      data-icon3d={name}
      className={`block shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

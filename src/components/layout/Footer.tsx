import Icon from "@/components/ui/Icon";
import styles from "@/styles/maxwidth.module.css";

export default function Footer() {
  return (
    <footer className="relative z-[10] font-[family-name:var(--font-geist-sans)] text-white w-full bg-[#1C1C1C] px-6 py-4 flex flex-col items-center justify-center">
      <div className={styles.maxWidthContainer} style={{ height: "auto", position: "static" }}>
        <div className="flex flex-col gap-4 items-center w-full pb-5 border-b-1 border-[#262626] mb-4">
          <h2 className="flex gap-2 items-center text-white text-[20px] font-bold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="Federação Rebug" src="/rebug-dc.webp" className="h-[65px] w-auto" />
          </h2>
        </div>

        <div className="w-full flex flex-row items-center justify-center flex-wrap gap-4 pb-4 border-b-1 border-[#262626]">
          <span className="flex gap-2 items-center text-[12px] lg:text-[14px]">
            <Icon name="envelope" className="text-yellow-500" /> contato@federacaorebug.com
          </span>
          <span className="flex gap-2 items-center text-[12px] lg:text-[14px]">
            <Icon name="location-dot" className="text-yellow-500" /> hubbe.biz
          </span>
        </div>

        <div className=" lg:px-3 lg:pr-6 lg:pt-2 lg:py-2 lg:mt-4 lg:rounded-full pt-10 relative mt-10 bg-[#1A1A1A] w-full border-1 border-[#262626] rounded-xl flex flex-col items-center justify-center lg:justify-between lg:flex-row gap-4 py-4">
          <div className="flex items-center gap-4 absolute lg:static lg:transform-none lg:translate-none left-1/2 transform -translate-x-1/2 top-[-22px]">
            <a
              href="https://hubbe.biz"
              target="_blank"
              className="flex items-center justify-center rounded-full w-[44px] h-[44px] bg-yellow-500 text-yellow-800 text-[18px] lg:text-[20px] lg:w-[33px] lg:h-[33px]"
            >
              <Icon name="hotel" />
            </a>
            <a
              target="_blank"
              className="flex items-center justify-center rounded-full w-[44px] h-[44px] bg-yellow-500 text-yellow-800 text-[18px] lg:text-[20px] lg:w-[33px] lg:h-[33px]"
            >
              <Icon name="futbol" />
            </a>
            <a
              href="#"
              target="_blank"
              className="flex items-center justify-center rounded-full w-[44px] h-[44px] bg-yellow-500 text-yellow-800 text-[18px] lg:text-[20px] lg:w-[33px] lg:h-[33px]"
            >
              <Icon name="youtube" />
            </a>
          </div>
          <span className="text-[#B3B3B3] text-[12px] lg:text-[14px]">
            Federação Rebug all rights reserved © 2025
          </span>
        </div>
      </div>
    </footer>
  );
}

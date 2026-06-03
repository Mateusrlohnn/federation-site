import Image from "next/image";
import SplineScene from "@/components/home/SplineScene";
import maxwidth from "@/styles/maxwidth.module.css";
import hero from "@/styles/hero.module.css";

const organizers = [
  { file: "Levi", display: "Levi" },
  { file: "LebronGames", display: "LebronGames" },
  { file: "Pkzera", display: "Pkzera" },
];

export default function Home() {
  return (
    <div className="font-[family-name:var(--font-geist-sans)]">
      <main className="w-full flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <div className={hero.spline}>
          <SplineScene />
        </div>

        <Image
          alt="Squares"
          width={1920}
          height={240}
          className="absolute top-[-100px] z-[1]"
          src="/images/home.webp"
          priority
        />

        <div className={maxwidth.maxWidthContainer} style={{ height: "auto", position: "static" }}>
          <div className="grid md:grid-cols-2 md:grid-rows-1 w-full">
            {/* LEFT CARD */}
            <div className="flex items-center">
              <div className="flex flex-col gap-2 bg-[#5c5c5c51] backdrop-blur p-2 rounded-xl border border-[#8d8d8d68]">
                <div className="flex items-end p-2 h-[200px] w-[336px] bg-[#1d1d1d] rounded-lg">
                  <div className="flex flex-col gap-1">
                    <span className="bg-yellow-500 text-yellow-800 w-max font-bold py-1 px-2 text-sm rounded">
                      hubbe.biz
                    </span>
                    <span className="text-sm">1Q football no Hubbe</span>
                  </div>
                </div>

                <div className="mt-7 grid grid-cols-3 grid-rows-2 gap-x-2 gap-y-1 text-center text-xs">
                  {organizers.map((f) => (
                    <div
                      key={f.file}
                      className="flex items-center justify-center relative w-full h-10 rounded-md border border-yellow-200"
                    >
                      <div className="flex items-center justify-center overflow-hidden h-[69px] w-[110px] absolute top-[-31px]">
                        <div className="relative inline-block group">
                          <Image
                            alt={`${f.file} avatar`}
                            width={64}
                            height={100}
                            quality={100}
                            src={`/avatars/${f.file}.png`}
                          />
                          <span className="shadow font-bold absolute bottom-10 left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#202020] border border-[#434343] px-2 py-1 text-xs text-[#b1b1b1] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            {f.file}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {organizers.map((f) => (
                    <span key={`name-${f.file}`} className="font-semibold">
                      {f.display}
                    </span>
                  ))}
                </div>

                <p className="max-w-[336px] mt-[-20px] text-xs text-[#8d8d8daa]">
                  A Federação Rebug é organizada por Levi, LebronGames e Pkzera, desenvolvendo
                  campeonatos de alto nível e entregando inovação na modalidade 1q do Hubbe.
                </p>

                <div className="w-full flex flex-col gap-1 items-center">
                  <a
                    href="https://hubbe.biz/"
                    target="_blank"
                    className="w-full flex items-center justify-center py-2 bg-yellow-500 hover:bg-yellow-600 hover:text-yellow-900 text-yellow-800 rounded-lg font-bold text-sm cursor-pointer"
                  >
                    JOIN GAME
                  </a>
                  <span className="text-xs text-[#8d8d8d68]">Enjoy the experience</span>
                </div>
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="w-full flex flex-col items-end justify-between">
              <div className="z-[2] text-left max-w-[400px] flex flex-col gap-4 p-6">
                <span className="text-yellow-500">FEDERAÇÃO REBUG</span>
                <h1 className="text-[60px] font-bold leading-14">RISE UP. PLAY WITH THE BESTS</h1>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Federação Rebug"
                className={`${hero.neonblink} h-[92px] w-auto`}
                src="/rebug-dc.webp"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

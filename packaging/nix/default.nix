{
  addDriverRunpath,
  alsa-lib,
  flite,
  glib,
  glib-networking,
  gsettings-desktop-schemas,
  jdk25,
  jdk17,
  jdk21,
  jdk8,
  jdks ? [
    jdk8
    jdk17
    jdk21
    jdk25
  ],
  lib,
  libGL,
  libjack2,
  libpulseaudio,
  libx11,
  libxcursor,
  libxext,
  libxrandr,
  libxxf86vm,
  fullriskclient-launcher-unwrapped,
  pipewire,
  stdenv,
  symlinkJoin,
  udev,
  wrapGAppsHook4,
}:

symlinkJoin {
  pname = "fullriskclient-launcher";
  inherit (fullriskclient-launcher-unwrapped) version;

  paths = [ fullriskclient-launcher ];

  strictDeps = true;

  nativeBuildInputs = [
    glib
    wrapGAppsHook4
  ];

  buildInputs = [
    glib-networking
    gsettings-desktop-schemas
  ];

  runtimeDependencies = lib.optionalString stdenv.hostPlatform.isLinux (
    lib.makeLibraryPath [
      addDriverRunpath.driverLink

      libGL
      libx11
      libxcursor
      libxext
      libxrandr
      libxxf86vm

      flite

      alsa-lib
      libjack2
      libpulseaudio
      pipewire

      udev
    ]
  );

  postBuild = ''
    gappsWrapperArgs+=(
      --prefix PATH : ${lib.makeSearchPath "bin/java" jdks}
      ${lib.optionalString stdenv.hostPlatform.isLinux ''
        --set LD_LIBRARY_PATH $runtimeDependencies
      ''}
    )

    glibPostInstallHook
    gappsWrapperArgsHook
    wrapGApp "$out/bin/noriskclient-launcher-v3"
  '';

  meta = {
    inherit (fullriskclient-launcher-unwrapped.meta)
      description
      homepage
      license
      longDescription
      maintainers
      mainProgram
      platforms
      ;
  };
}

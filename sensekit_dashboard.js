$(document).ready(function() {
  // constants
  const refreshDataRate = 1000;
  const searchRate = 500;
  const agentAddress = "https://agent.electricimp.com/Q55EE8z8iNZE";

  // variables
  var devices = {};
  var accelGraphData = [{label: "x", data:[]}, {label: "y", data:[]}, {label: "z", data:[]}];
  var dataRefreshLoop, connectedDevicesLoop, sidebarRefresh;
  var disconnectCounter = 0;

  // sidebar listeners
  $(".nav-sidebar").on("click", "li", loadDashboard);
  $("#disconnect").on("click", disconnectDevice);

  // look for available devices
  pollForActiveDevices();

  // look for connected devices
  pollForConnectedDevices();

  // chart options
  var graphOptions = {
    xaxis: {
        color: "#CCCCCC",
        mode: "time",
        timeformat: "%I:%M:%S %P",
        timezone: "browser"
    },
    series: {
        lines: {
            shadowSize: 0,
            show: true,
            lineWidth: 1.5
        }
    },
    grid: {
        backgroundColor: { colors: ["#7A7A7A", "#2B2B2B"] },
        // hoverable: true,
        // autoHighlight: true,
    },
    legend: {
      show: true,
      position: "nw",
      backgroundColor: "#7A7A7A",
      backgroundOpacity: 0.2,
      margin: 10
    },
  };

  // $("<div id='tooltip'></div>").appendTo("body");
  // $("#chart_div").bind("plothover", function (event, pos, item) {
  //   if (item) {
  //       var x = (new Date(item.datapoint[0])).toLocaleTimeString()
  //       var y = item.datapoint[1].toFixed(1);
  //       $("#tooltip").html("<p>" + item.series.label + "</p>" + x + "<br><span>" + y + "°F</span>")
  //           .css({top: item.pageY-50, left: item.pageX+5})
  //           .fadeIn(100);
  //   } else {
  //       $("#tooltip").hide();
  //   }
  // });

  ////// Page Functions //////

  //// Device Sidebar
  function updateActiveDeviceList(activeId) {
    for(device in devices) {
      $(".devices ul").append("<li data-id='" + device + "'><a href='#'>Device Id: " + device + "  RSSI: " + devices[device] + "</a></li>");
      if(activeId) {
        $("li[data-id="+activeId+"]").addClass("active");
      }
    }
  }

  function clearActiveDeviceList() {
    $(".devices ul").html("");
  }

  function getActiveSidebarId() {
    return ($(".sidebar .active").length > 0) ? $(".sidebar .active").data().id : "";
  }

  function disconnectDevice(e) {
    $(".sidebar .active").removeClass("active");
    disconnectFromDevice();
    hideDisconnectButton();
    clearDataRefreshLoop();
    clearAccGraph();
    $(".readings").addClass("hidden");
    setTimeout(function() { pollForConnectedDevices() }, 5000);
  }

  function showDisconnectButton() {
    $("#disconnect").removeClass("hidden");
  };

  function hideDisconnectButton() {
    $("#disconnect").addClass("hidden");
  };

  function updateSidebarStatus(deviceId) {
    $(".sidebar .active").removeClass("active");
    if ($("[data-id=" + deviceId + "]").text()) {
      $("[data-id=" + deviceId + "]").addClass("active");
    } else {
      setTimeout(function () {
        $("[data-id=" + deviceId + "]").addClass("active");
      }, 600);
    }
  };

  //// Dashboard
  function loadDashboard(e) {
    e.preventDefault();
    clearPollForConnectedDevices();
    var devId = e.currentTarget.dataset.id;
    if (getActiveSidebarId()) {
      clearDataRefreshLoop();
      clearAccGraph();
    };
    connectToDevice(devId);
  }

  function checkConnection(deviceId) {
    if (deviceId != "") {
      console.log("connected to :");
      console.log(deviceId);
      updateSidebarStatus(deviceId);
      showDisconnectButton();
      clearPollForConnectedDevices();
      getData();
      hidePressSensorButtonMsg();
    } else {
      showPressSensorButtonMsg();
    }
  }

  function showPressSensorButtonMsg() {
    $(".wake-msg").removeClass("hidden");
    if ($(".wake-msg").text() != "Hit button on sensor to wake it up!") {
      console.log("press button on sensor!!");
      $(".wake-msg").text("Hit button to wake up a device!");
    }
  }

  function hidePressSensorButtonMsg() {
    $(".wake-msg").text("").addClass("hidden");
  }

  function getData() {
    if (!dataRefreshLoop) {
      dataRefreshLoop = window.setInterval(function() {getSensorData(); }, refreshDataRate);
    }
  };

  function updateDashboard(data) {
    console.log(data);
    $(".readings").removeClass("hidden");
    for (k in data) {
      $("." + k + " .reading").text(data[k]);
    }
    graphAccData(data.accel);
  };

  function graphAccData(accelData) {
    var startTime = Date.now() - 1000
    for (var i = 0; i < accelData.length; i++) {
      for (var j = 0; j < accelGraphData.length; j++) {
        accelGraphData[j].data.push([startTime, accelData[i][j]]);
      }
      startTime += 100;
    }
    var plot = $.plot("#chart_div", accelGraphData, graphOptions);
    plot.setupGrid();
    plot.draw();
  };

  function clearAccGraph() {
    $("#chart_div").html("");
    accelGraphData = [{label: "x", data:[]}, {label: "y", data:[]}, {label: "z", data:[]}];
  }


  //// Helpers
  function getCurrentTime() {
    return (new Date()).toLocaleTimeString()
  }

  function updateCurrentTime(timeDiv) {
    timeDiv.text("Devices Updated at " + getCurrentTime());
  }

  function pollForConnectedDevices() {
    connectedDevicesLoop = window.setInterval(function() { getConnectedDevice(); }, searchRate);
  }

  function pollForActiveDevices() {
    sidebarRefresh = window.setInterval(function() { getDevices() }, searchRate);
  }

  function clearDataRefreshLoop() {
    window.clearInterval(dataRefreshLoop);
    dataRefreshLoop = undefined;
  }

  function clearPollForConnectedDevices() {
    window.clearInterval(connectedDevicesLoop);
    connectedDevicesLoop = undefined;
  }

  function clearPollForActiveDevices() {
    window.clearInterval(sidebarRefresh);
    connectedDevicesLoop = undefined;
  }

  ////// API Ajax requests //////

  //request avialable devices
  function getDevices() {
    $.ajax({
      url : agentAddress + "/listdevs",
      dataType : "json",
      success : function(response) {
        if (JSON.stringify(response) != JSON.stringify(devices)) {
          var activeId = getActiveSidebarId();
          devices = response;
          clearActiveDeviceList();
          updateActiveDeviceList(activeId);
          if (Object.keys(devices).length > 0) {
            $(".sidebar h5").removeClass("hidden");
          } else {
            $(".sidebar h5").addClass("hidden");
          }
        }
        updateCurrentTime($(".devices .time"));
      }
    });
  }

  //request connected device
  // returns deviceId or ""
  function getConnectedDevice() {
    $.ajax({
      url : agentAddress + "/getconnecteddev",
      success : function(response) {
        checkConnection(response)
      }
    });
  }


  //connect to a device
  function connectToDevice(devId) {
    $.ajax({
      url : agentAddress + "/connectto",
      type: "post",
      data: devId,
      success : function(response) {
        setTimeout(function() { getConnectedDevice(); }, 600);
      }
    });
  }

  //disconnect from a device
  function disconnectFromDevice() {
    $.ajax({
      url : agentAddress + "/disconnect",
      success : function(response) {
        console.log(response);
      }
    });
  }

  //get data from connected device
  function getSensorData() {
    $.ajax({
      url : agentAddress + "/getupdate",
      dataType : "json",
      success : function(response) {
        if(response.humid === null && response.temp === null && response.press === null && response.batt === null && response.mag.length === 0 && response.gyro.length === 0 && response.accel.length === 0) {
          console.log("null data")
          if (disconnectCounter < 4) {
            disconnectCounter++;
          } else {
            disconnectCounter = 0;
            disconnectDevice();
          }
        } else {
          updateDashboard(response);
        }
        //response should look like
        // { "press": 1002.2, "humid": 22.4, "gyro": [ -104, 476, -462 ], "batt": 21, "temp": 21.6, "accel": [ [ 1, 0, 86 ], [ 1, -1, 87 ], [ 1, -1, 86 ], [ 2, -1, 86 ], [ 2, -1, 86 ], [ 1, 0, 86 ], [ 0, -1, 87 ], [ 2, -1, 86 ], [ 1, -1, 86 ], [ 2, -1, 86 ] ], "mag": [ -554, 903, -2347 ] }
      }
    });
  }
})

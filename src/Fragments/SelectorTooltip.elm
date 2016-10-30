module Fragments.SelectorTooltip exposing (selectorTooltip)

import Html exposing (span, div, text)
import Html.Attributes exposing (style, property)
import Json.Encode


selectorTooltip :
    { a
        | tagName : String
        , x : Int
        , y : Int
        , distanceToTop : Int
        , width : Int
        , height : Int
        , classList : List String
        , id : Maybe String
    }
    -> Int
    -> Html.Html msg
selectorTooltip el screenHeight =
    let
        heightOfTooltip =
            35

        bottomOfTheScreen =
            screenHeight - heightOfTooltip - el.distanceToTop

        topCoordinate =
            min bottomOfTheScreen el.height

        isAboveElement =
            el.distanceToTop > heightOfTooltip

        dimensions =
            span
                [ property "innerHTML"
                    (Json.Encode.string
                        ((toString el.width) ++ "&times;" ++ (toString el.height))
                    )
                ]
                []

        id =
            case el.id of
                Just id ->
                    coloredText "#FFAB66" ("#" ++ id)

                Nothing ->
                    text ""

        tag =
            span [ style [ ( "font-weight", "bold" ), ( "color", "#EE78E6" ) ] ]
                [ text el.tagName ]

        classes =
            el.classList
                |> List.map ((++) ".")
                |> List.map (coloredText "#8ED3FB")
    in
        div
            [ style (selectorTooltipInlineStyle isAboveElement topCoordinate) ]
            ([ tooltipTriangle isAboveElement
             , tag
             , id
             , coloredNodes "#8ED3FB" classes
             , coloredText "#7F7F7F" " | "
             , dimensions
             ]
            )


selectorTooltipInlineStyle : Bool -> Int -> List ( String, String )
selectorTooltipInlineStyle isAboveElement height =
    let
        top =
            if isAboveElement then
                "-28px"
            else
                (toString (height + 10)) ++ "px"
    in
        [ ( "position", "absolute" )
        , ( "height", "20px" )
        , ( "line-height", "20px" )
        , ( "text-align", "center" )
        , ( "border-radius", "2px" )
        , ( "left", "0px" )
        , ( "white-space", "nowrap" )
        , ( "min-width", "50px" )
        , ( "text-align", "left" )
        , ( "padding-left", "6px" )
        , ( "padding-right", "6px" )
        , ( "font-weight", "normal" )
        , ( "font-family", "menlo, monospace" )
        , ( "font-size", "10px" )
        , ( "background", "#333740" )
        , ( "color", "#D9D9D9" )
          --, ( "box-shadow", "0 0 1px 0 #D9D9D9" )
        , ( "left", "0" )
        , ( "top", top )
        ]


tooltipTriangle : Bool -> Html.Html msg
tooltipTriangle isAboveElement =
    if isAboveElement then
        div
            [ style
                [ ( "width", "0" )
                , ( "height", "0" )
                , ( "position", "absolute" )
                , ( "left", "20px" )
                , ( "top", "20px" )
                , ( "border", "7px solid transparent" )
                , ( "border-top-color", "#333740" )
                , ( "border-bottom-color", "transparent" )
                ]
            ]
            []
    else
        div
            [ style
                [ ( "width", "0" )
                , ( "height", "0" )
                , ( "position", "absolute" )
                , ( "left", "20px" )
                , ( "border", "7px solid transparent" )
                , ( "top", "-14px" )
                , ( "border-bottom-color", "#333740" )
                , ( "border-top-color", "transparent" )
                ]
            ]
            []


coloredNodes : String -> List (Html.Html msg) -> Html.Html msg
coloredNodes color nodes =
    span [ style [ ( "color", color ) ] ] nodes


coloredText : String -> String -> Html.Html msg
coloredText color str =
    span [ style [ ( "color", color ) ] ] [ text str ]
